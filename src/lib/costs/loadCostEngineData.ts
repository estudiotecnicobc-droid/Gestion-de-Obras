/**
 * loadCostEngineData.ts
 * ──────────────────────
 * Carga desde Supabase todo lo necesario para construir un RecursiveEngineContext.
 *
 * Retorna:
 *   · tasksMap      — Map<masterTaskId, MasterTask>
 *   · resourcesMap  — Map<resourceId, Resource>
 *   · allResourceIds — todos los resourceId referenciados en las tareas
 *
 * El llamador es responsable de:
 *   1. Llamar bulkLoadCosts() con allResourceIds para obtener el BulkCostMap
 *   2. Combinar todo en RecursiveEngineContext con buildResolveCost()
 *
 * Acepta SupabaseClient como parámetro para funcionar tanto desde el frontend
 * (anon key) como desde scripts Node (service_role).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MasterTask,
  MasterTaskMaterial,
  MasterTaskLabor,
  MasterTaskEquipment,
  Resource,
  RecursiveEngineContext,
} from '../../../types.js';
import { bulkLoadCosts, buildResolveCost } from './supabaseCostService.js';

// ── Mappers (misma lógica que masterTasksSupabaseService.ts) ──────────────────

function taskFromRow(row: Record<string, any>): Omit<MasterTask, 'materials' | 'labor' | 'equipment'> {
  return {
    id:                    row.id,
    organizationId:        row.organization_id,
    code:                  row.code             ?? undefined,
    name:                  row.name,
    description:           row.description      ?? undefined,
    unit:                  row.unit,
    category:              row.category         ?? undefined,
    dailyYield:            Number(row.daily_yield),
    fixedCost:             row.fixed_cost        != null ? Number(row.fixed_cost)        : undefined,
    fixedCostDescription:  row.fixed_cost_description ?? undefined,
    specifications:        row.specifications    ?? undefined,
    tags:                  row.tags              ?? [],
    isActive:              row.is_active,
    createdAt:             row.created_at,
    updatedAt:             row.updated_at,
  };
}

function materialFromRow(row: Record<string, any>): MasterTaskMaterial {
  return {
    id:                 row.id,
    masterMaterialId:   row.master_material_id   ?? undefined,
    materialName:       row.material_name,
    unit:               row.unit,
    quantity:           Number(row.quantity),
    wastePercent:       row.waste_percent        != null ? Number(row.waste_percent)         : undefined,
    lastKnownUnitPrice: row.last_known_unit_price != null ? Number(row.last_known_unit_price) : undefined,
    resourceId:         row.resource_id          ?? undefined,
    subMasterTaskId:    row.sub_master_task_id   ?? undefined,
    conversionFactor:   row.conversion_factor    != null ? Number(row.conversion_factor)     : undefined,
  };
}

function laborFromRow(row: Record<string, any>): MasterTaskLabor {
  return {
    id:                 row.id,
    laborCategoryId:    row.labor_category_id,
    laborCategoryName:  row.labor_category_name,
    quantity:           Number(row.quantity),
    resourceId:         row.resource_id          ?? undefined,
    snapshotHourlyRate: row.snapshot_hourly_rate != null ? Number(row.snapshot_hourly_rate) : undefined,
  };
}

function equipmentFromRow(row: Record<string, any>): MasterTaskEquipment {
  return {
    id:                  row.id,
    toolId:              row.tool_id,
    toolName:            row.tool_name,
    hoursPerUnit:        Number(row.hours_per_unit),
    resourceId:          row.resource_id             ?? undefined,
    snapshotCostPerHour: row.snapshot_cost_per_hour != null ? Number(row.snapshot_cost_per_hour) : undefined,
  };
}

function resourceFromRow(row: Record<string, any>): Resource {
  return {
    id:              row.id,
    catalogId:       row.catalog_id       ?? undefined,
    organizationId:  row.organization_id  ?? undefined,
    code:            row.code             ?? undefined,
    name:            row.name,
    unit:            row.unit,
    type:            row.type,
    baseCost:        Number(row.base_cost),
    socialChargesPct: row.social_charges_pct != null ? Number(row.social_charges_pct) : undefined,
    isActive:        row.is_active,
    pricingNotes:    row.pricing_notes    ?? undefined,
    currentSnapshotId: row.current_snapshot_id ?? undefined,
  };
}

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export interface CostEngineData {
  tasksMap:       Map<string, MasterTask>;
  resourcesMap:   Map<string, Resource>;
  allResourceIds: string[];
}

// ── Loader principal ──────────────────────────────────────────────────────────

/**
 * Carga MasterTasks (con sub-tablas) y Resources de una organización.
 *
 * Incluye recursos globales (organization_id IS NULL) para garantizar
 * que los recursos del catálogo base siempre estén disponibles.
 *
 * @param client   - cliente Supabase (anon o service_role)
 * @param tenantId - UUID de la organización
 */
export async function loadCostEngineData(
  client:   SupabaseClient,
  tenantId: string,
): Promise<CostEngineData> {
  // ── 1. MasterTasks activas de la org ───────────────────────────────────────
  const { data: taskRows, error: taskErr } = await client
    .from('master_tasks')
    .select('*')
    .eq('organization_id', tenantId)
    .eq('is_active', true);

  if (taskErr) throw new Error(`loadCostEngineData [master_tasks]: ${taskErr.message}`);
  if (!taskRows?.length) {
    return { tasksMap: new Map(), resourcesMap: new Map(), allResourceIds: [] };
  }

  const taskIds = taskRows.map((r: any) => r.id as string);

  // ── 2. Sub-tablas (bulk, no N+1) ──────────────────────────────────────────
  const [matsResult, laborResult, equipResult] = await Promise.all([
    client.from('master_task_materials').select('*').in('master_task_id', taskIds),
    client.from('master_task_labor').select('*').in('master_task_id', taskIds),
    client.from('master_task_equipment').select('*').in('master_task_id', taskIds),
  ]);

  if (matsResult.error)  throw new Error(`loadCostEngineData [materials]: ${matsResult.error.message}`);
  if (laborResult.error) throw new Error(`loadCostEngineData [labor]: ${laborResult.error.message}`);
  if (equipResult.error) throw new Error(`loadCostEngineData [equipment]: ${equipResult.error.message}`);

  // Agrupar sub-filas por master_task_id
  const matsBy:  Record<string, MasterTaskMaterial[]>  = {};
  const laborBy: Record<string, MasterTaskLabor[]>     = {};
  const equipBy: Record<string, MasterTaskEquipment[]> = {};

  for (const r of (matsResult.data  ?? [])) { (matsBy[r.master_task_id]  ??= []).push(materialFromRow(r));  }
  for (const r of (laborResult.data ?? [])) { (laborBy[r.master_task_id] ??= []).push(laborFromRow(r));     }
  for (const r of (equipResult.data ?? [])) { (equipBy[r.master_task_id] ??= []).push(equipmentFromRow(r)); }

  // ── 3. Construir tasksMap ──────────────────────────────────────────────────
  const tasksMap = new Map<string, MasterTask>();

  for (const row of taskRows) {
    const task: MasterTask = {
      ...taskFromRow(row),
      materials: matsBy[row.id]  ?? [],
      labor:     laborBy[row.id] ?? [],
      equipment: equipBy[row.id] ?? [],
    };
    tasksMap.set(task.id, task);
  }

  // ── 4. Recolectar todos los resourceIds referenciados ─────────────────────
  const resourceIdSet = new Set<string>();

  for (const task of tasksMap.values()) {
    for (const m of task.materials) { if (m.resourceId) resourceIdSet.add(m.resourceId); }
    for (const l of task.labor)     { if (l.resourceId) resourceIdSet.add(l.resourceId); }
    for (const e of task.equipment) { if (e.resourceId) resourceIdSet.add(e.resourceId); }
  }

  const allResourceIds = [...resourceIdSet];

  // ── 5. Cargar recursos referenciados ──────────────────────────────────────
  const resourcesMap = new Map<string, Resource>();

  if (allResourceIds.length > 0) {
    const { data: resRows, error: resErr } = await client
      .from('resources')
      .select('*')
      .in('id', allResourceIds);

    if (resErr) throw new Error(`loadCostEngineData [resources]: ${resErr.message}`);

    for (const r of (resRows ?? [])) {
      resourcesMap.set(r.id, resourceFromRow(r));
    }
  }

  // ── 6. Enriquecer con labor_categories y tools (fallback pre-migration 010) ─
  await enrichLaborRates(client, tenantId, tasksMap);
  await enrichEquipmentRates(client, tenantId, tasksMap);

  return { tasksMap, resourcesMap, allResourceIds };
}

// ── Enriquecedores de tasas (datos sin resource_id) ───────────────────────────

async function enrichLaborRates(
  client:   SupabaseClient,
  tenantId: string,
  tasksMap: Map<string, MasterTask>,
): Promise<void> {
  const needIds = new Set<string>();
  for (const t of tasksMap.values())
    for (const l of t.labor)
      if (!l.resourceId && l.snapshotHourlyRate == null) needIds.add(l.laborCategoryId);
  if (needIds.size === 0) return;

  const { data, error } = await client
    .from('labor_categories')
    .select('id, basic_hourly_rate, social_charges_percent, insurance_percent')
    .eq('organization_id', tenantId)
    .in('id', [...needIds]);
  if (error) { console.warn(`[loadCostEngineData] labor_categories: ${error.message}`); return; }

  const rateMap = new Map<string, number>();
  for (const r of (data ?? []))
    rateMap.set(r.id, (r.basic_hourly_rate ?? 0) *
      (1 + ((r.social_charges_percent ?? 0) + (r.insurance_percent ?? 0)) / 100));

  for (const t of tasksMap.values())
    for (const l of t.labor)
      if (!l.resourceId && l.snapshotHourlyRate == null) {
        const rate = rateMap.get(l.laborCategoryId);
        if (rate != null) (l as any).snapshotHourlyRate = rate;
      }
}

async function enrichEquipmentRates(
  client:   SupabaseClient,
  tenantId: string,
  tasksMap: Map<string, MasterTask>,
): Promise<void> {
  const needIds = new Set<string>();
  for (const t of tasksMap.values())
    for (const e of t.equipment)
      if (!e.resourceId && e.snapshotCostPerHour == null) needIds.add(e.toolId);
  if (needIds.size === 0) return;

  const { data, error } = await client
    .from('tools')
    .select('id, cost_per_hour')
    .eq('organization_id', tenantId)
    .in('id', [...needIds]);
  if (error) { console.warn(`[loadCostEngineData] tools: ${error.message}`); return; }

  const costMap = new Map<string, number>();
  for (const r of (data ?? [])) costMap.set(r.id, r.cost_per_hour ?? 0);

  for (const t of tasksMap.values())
    for (const e of t.equipment)
      if (!e.resourceId && e.snapshotCostPerHour == null) {
        const cost = costMap.get(e.toolId);
        if (cost != null) (e as any).snapshotCostPerHour = cost;
      }
}

// ── Factory completa: RecursiveEngineContext ──────────────────────────────────

/**
 * Carga datos y construye un RecursiveEngineContext listo para usar.
 * Combina loadCostEngineData + bulkLoadCosts + buildResolveCost en un paso.
 *
 * @param client   - cliente Supabase
 * @param tenantId - UUID de la organización
 * @param costDate - YYYY-MM-DD — fecha de referencia para snapshots de costo
 */
export async function buildCostEngineContext(
  client:   SupabaseClient,
  tenantId: string,
  costDate: string,
): Promise<Omit<RecursiveEngineContext, 'visited' | 'computed'>> {
  const { tasksMap, resourcesMap, allResourceIds } = await loadCostEngineData(client, tenantId);

  const costMap = await bulkLoadCosts(client, tenantId, allResourceIds, costDate);
  const resolveCost = buildResolveCost(costMap);

  return {
    organizationId: tenantId,
    costDate,
    tasksMap,
    resourcesMap,
    resolveCost,
  };
}
