/**
 * loadSupabaseDemoData.ts
 * ────────────────────────
 * QUÉ HACE:
 *   Carga UNA master_task desde Supabase (con sus materiales, MO y equipos)
 *   más los resources que esa tarea referencia.
 *   Devuelve todo listo para armar RecursiveEngineContext.
 *
 * QUÉ TENÉS QUE HACER VOS:
 *   Nada. Solo tener master_tasks con resource_id en sus sub-tablas.
 *   Si no hay resource_id, el motor usa lastKnownUnitPrice como fallback.
 *
 * IMPORTANTE:
 *   - Usa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service_role, bypass RLS).
 *   - Tablas requeridas: master_tasks, master_task_materials,
 *     master_task_labor, master_task_equipment, resources.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MasterTask,
  MasterTaskMaterial,
  MasterTaskLabor,
  MasterTaskEquipment,
  Resource,
} from '../../../types.js';

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export interface DemoTaskData {
  task:           MasterTask;
  tasksMap:       Map<string, MasterTask>;  // incluye sub-APUs anidados si existen
  resourcesMap:   Map<string, Resource>;
  allResourceIds: string[];
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toMaterial(r: any): MasterTaskMaterial {
  return {
    id:                 r.id,
    masterMaterialId:   r.master_material_id   ?? undefined,
    materialName:       r.material_name,
    unit:               r.unit,
    quantity:           Number(r.quantity),
    wastePercent:       r.waste_percent        != null ? Number(r.waste_percent)         : undefined,
    lastKnownUnitPrice: r.last_known_unit_price != null ? Number(r.last_known_unit_price) : undefined,
    resourceId:         r.resource_id          ?? undefined,
    subMasterTaskId:    r.sub_master_task_id   ?? undefined,
    conversionFactor:   r.conversion_factor    != null ? Number(r.conversion_factor)     : undefined,
  };
}

function toLabor(r: any): MasterTaskLabor {
  return {
    id:                 r.id,
    laborCategoryId:    r.labor_category_id,
    laborCategoryName:  r.labor_category_name,
    quantity:           Number(r.quantity),
    resourceId:         r.resource_id          ?? undefined,
    snapshotHourlyRate: r.snapshot_hourly_rate != null ? Number(r.snapshot_hourly_rate) : undefined,
  };
}

function toEquipment(r: any): MasterTaskEquipment {
  return {
    id:                  r.id,
    toolId:              r.tool_id,
    toolName:            r.tool_name,
    hoursPerUnit:        Number(r.hours_per_unit),
    resourceId:          r.resource_id             ?? undefined,
    snapshotCostPerHour: r.snapshot_cost_per_hour != null ? Number(r.snapshot_cost_per_hour) : undefined,
  };
}

function toResource(r: any): Resource {
  return {
    id:             r.id,
    catalogId:      r.catalog_id      ?? undefined,
    organizationId: r.organization_id ?? undefined,
    code:           r.code            ?? undefined,
    name:           r.name,
    unit:           r.unit,
    type:           r.type,
    baseCost:       Number(r.base_cost ?? 0),
    isActive:       r.is_active,
  };
}

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Carga una master_task activa para la org dada.
 * Si se pasa `taskId`, carga esa; si no, toma la primera disponible.
 * También carga sub-APUs anidados (subMasterTaskId) en el mismo batch.
 */
export async function loadSupabaseDemoData(
  client:   SupabaseClient,
  tenantId: string,
  taskId?:  string,
): Promise<DemoTaskData | null> {

  // ── 1. Tarea principal ────────────────────────────────────────────────────
  const q = client
    .from('master_tasks')
    .select('*')
    .eq('organization_id', tenantId)
    .eq('is_active', true);

  const { data: taskRows, error: taskErr } = taskId
    ? await q.eq('id', taskId).limit(1)
    : await q.order('created_at', { ascending: false }).limit(1);

  if (taskErr) throw new Error(`loadSupabaseDemoData [master_tasks]: ${taskErr.message}`);
  if (!taskRows?.length) return null;

  const mainRow = taskRows[0];

  // ── 2. Sub-tablas de la tarea principal ───────────────────────────────────
  const [matsRes, laborRes, equipRes] = await Promise.all([
    client.from('master_task_materials').select('*').eq('master_task_id', mainRow.id),
    client.from('master_task_labor').select('*').eq('master_task_id', mainRow.id),
    client.from('master_task_equipment').select('*').eq('master_task_id', mainRow.id),
  ]);

  if (matsRes.error)  throw new Error(`loadSupabaseDemoData [materials]: ${matsRes.error.message}`);
  if (laborRes.error) throw new Error(`loadSupabaseDemoData [labor]: ${laborRes.error.message}`);
  if (equipRes.error) throw new Error(`loadSupabaseDemoData [equipment]: ${equipRes.error.message}`);

  const materials = (matsRes.data  ?? []).map(toMaterial);
  const labor     = (laborRes.data ?? []).map(toLabor);
  const equipment = (equipRes.data ?? []).map(toEquipment);

  const mainTask: MasterTask = {
    id:             mainRow.id,
    organizationId: mainRow.organization_id,
    code:           mainRow.code            ?? undefined,
    name:           mainRow.name,
    description:    mainRow.description     ?? undefined,
    unit:           mainRow.unit,
    category:       mainRow.category        ?? undefined,
    dailyYield:     Number(mainRow.daily_yield),
    fixedCost:      mainRow.fixed_cost      != null ? Number(mainRow.fixed_cost) : undefined,
    tags:           mainRow.tags            ?? [],
    isActive:       mainRow.is_active,
    createdAt:      mainRow.created_at,
    updatedAt:      mainRow.updated_at,
    materials,
    labor,
    equipment,
  };

  // ── 3. Sub-APUs anidados (subMasterTaskId) ───────────────────────────────
  const subIds = materials
    .map(m => m.subMasterTaskId)
    .filter((id): id is string => !!id);

  const tasksMap = new Map<string, MasterTask>([[mainTask.id, mainTask]]);

  if (subIds.length > 0) {
    const { data: subRows, error: subErr } = await client
      .from('master_tasks')
      .select('*')
      .in('id', subIds);

    if (subErr) throw new Error(`loadSupabaseDemoData [sub_tasks]: ${subErr.message}`);

    for (const sr of (subRows ?? [])) {
      const [sm, sl, se] = await Promise.all([
        client.from('master_task_materials').select('*').eq('master_task_id', sr.id),
        client.from('master_task_labor').select('*').eq('master_task_id', sr.id),
        client.from('master_task_equipment').select('*').eq('master_task_id', sr.id),
      ]);
      const sub: MasterTask = {
        id: sr.id, organizationId: sr.organization_id, name: sr.name,
        unit: sr.unit, dailyYield: Number(sr.daily_yield), isActive: sr.is_active,
        tags: sr.tags ?? [], createdAt: sr.created_at, updatedAt: sr.updated_at,
        materials:  (sm.data ?? []).map(toMaterial),
        labor:      (sl.data ?? []).map(toLabor),
        equipment:  (se.data ?? []).map(toEquipment),
      };
      tasksMap.set(sub.id, sub);
    }
  }

  // ── 4. Recolectar resource_ids referenciados ──────────────────────────────
  const resourceIdSet = new Set<string>();
  for (const t of tasksMap.values()) {
    for (const m of t.materials) { if (m.resourceId) resourceIdSet.add(m.resourceId); }
    for (const l of t.labor)     { if (l.resourceId) resourceIdSet.add(l.resourceId); }
    for (const e of t.equipment) { if (e.resourceId) resourceIdSet.add(e.resourceId); }
  }
  const allResourceIds = [...resourceIdSet];

  // ── 5. Cargar resources ───────────────────────────────────────────────────
  const resourcesMap = new Map<string, Resource>();

  if (allResourceIds.length > 0) {
    const { data: resRows, error: resErr } = await client
      .from('resources')
      .select('*')
      .in('id', allResourceIds);

    if (resErr) throw new Error(`loadSupabaseDemoData [resources]: ${resErr.message}`);
    for (const r of (resRows ?? [])) resourcesMap.set(r.id, toResource(r));
  }

  // ── 6. Enriquecer con labor_categories y tools (datos pre-migration 010) ──
  // Si las sub-filas no tienen resource_id ni snapshot de tarifa, las inferimos
  // desde labor_categories (basicHourlyRate × cargas) y tools (costPerHour).
  await enrichLaborRates(client, tenantId, tasksMap);
  await enrichEquipmentRates(client, tenantId, tasksMap);

  return { task: mainTask, tasksMap, resourcesMap, allResourceIds };
}

// ── Enriquecedores de tasas (fallback para datos pre-migration 010) ───────────

async function enrichLaborRates(
  client:   SupabaseClient,
  tenantId: string,
  tasksMap: Map<string, MasterTask>,
): Promise<void> {
  // Recolectar laborCategoryIds sin snapshotHourlyRate y sin resourceId
  const needIds = new Set<string>();
  for (const t of tasksMap.values()) {
    for (const l of t.labor) {
      if (!l.resourceId && l.snapshotHourlyRate == null) {
        needIds.add(l.laborCategoryId);
      }
    }
  }
  if (needIds.size === 0) return;

  const { data, error } = await client
    .from('labor_categories')
    .select('id, basic_hourly_rate, social_charges_percent, insurance_percent')
    .eq('organization_id', tenantId)
    .in('id', [...needIds]);

  if (error) {
    console.warn(`[loadSupabaseDemoData] No se pudo cargar labor_categories: ${error.message}`);
    return;
  }

  // rate = basicHourlyRate × (1 + (social + insurance) / 100)  — igual a masterTaskCostService
  const rateMap = new Map<string, number>();
  for (const r of (data ?? [])) {
    const rate = (r.basic_hourly_rate ?? 0) *
      (1 + ((r.social_charges_percent ?? 0) + (r.insurance_percent ?? 0)) / 100);
    rateMap.set(r.id, rate);
  }

  // Inyectar en los labor rows
  for (const t of tasksMap.values()) {
    for (const l of t.labor) {
      if (!l.resourceId && l.snapshotHourlyRate == null) {
        const rate = rateMap.get(l.laborCategoryId);
        if (rate != null) (l as any).snapshotHourlyRate = rate;
      }
    }
  }
}

async function enrichEquipmentRates(
  client:   SupabaseClient,
  tenantId: string,
  tasksMap: Map<string, MasterTask>,
): Promise<void> {
  const needIds = new Set<string>();
  for (const t of tasksMap.values()) {
    for (const e of t.equipment) {
      if (!e.resourceId && e.snapshotCostPerHour == null) {
        needIds.add(e.toolId);
      }
    }
  }
  if (needIds.size === 0) return;

  const { data, error } = await client
    .from('tools')
    .select('id, cost_per_hour')
    .eq('organization_id', tenantId)
    .in('id', [...needIds]);

  if (error) {
    console.warn(`[loadSupabaseDemoData] No se pudo cargar tools: ${error.message}`);
    return;
  }

  const costMap = new Map<string, number>();
  for (const r of (data ?? [])) costMap.set(r.id, r.cost_per_hour ?? 0);

  for (const t of tasksMap.values()) {
    for (const e of t.equipment) {
      if (!e.resourceId && e.snapshotCostPerHour == null) {
        const cost = costMap.get(e.toolId);
        if (cost != null) (e as any).snapshotCostPerHour = cost;
      }
    }
  }
}
