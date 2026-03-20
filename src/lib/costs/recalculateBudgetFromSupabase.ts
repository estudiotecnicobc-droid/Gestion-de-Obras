/**
 * recalculateBudgetFromSupabase.ts
 * ──────────────────────────────────
 * Recalcula el costo completo de un presupuesto real usando una base de costos.
 * Sin RPCs individuales — todo en bulk.
 *
 * Flujo (5 queries totales):
 *   1. budget_items    — ítems del presupuesto del proyecto
 *   2. tasks           — tareas del proyecto (para resolver masterTaskId)
 *   3. master_tasks + sub-tablas   (via loadCostEngineData — 4 queries bulk)
 *   4. resource_cost_snapshots     (via bulkLoadCosts — 2 queries bulk)
 *   → Motor puro: 0 queries adicionales
 *
 * Acepta SupabaseClient como parámetro → funciona desde scripts (service_role)
 * y desde el frontend (anon key).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudgetCostResult, BudgetItemCost } from '../../../types.js';
import { loadCostEngineData } from './loadCostEngineData.js';
import { bulkLoadCosts, buildResolveCost } from './supabaseCostService.js';
import { computeTaskCost } from '../../../services/recursiveCostEngine.js';
import type { RecursiveEngineContext } from '../../../types.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface RecalcFromSupabaseParams {
  projectId:      string;  // UUID del proyecto
  organizationId: string;  // UUID real (organizations.id), NUNCA 'org_a'
  costDate:       string;  // YYYY-MM-DD — snapshots con effective_date <= este valor
}

export interface RecalcFromSupabaseResult extends BudgetCostResult {
  /** Ítems del presupuesto sin masterTaskId vinculado (omitidos del cálculo) */
  skippedItems: number;
  /** Recursos que usaron fallback a base_cost en lugar de snapshot */
  fallbackResources: number;
  /** Recursos con snapshot real */
  snapshotResources: number;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function recalculateBudgetFromSupabase(
  client: SupabaseClient,
  params: RecalcFromSupabaseParams,
): Promise<RecalcFromSupabaseResult> {
  const { projectId, organizationId, costDate } = params;

  // ── Query 1: budget_items del proyecto ────────────────────────────────────
  const { data: biRows, error: biErr } = await client
    .from('budget_items')
    .select('id, task_id, quantity')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (biErr) throw new Error(`recalculateBudgetFromSupabase [budget_items]: ${biErr.message}`);

  if (!biRows?.length) {
    return emptyResult(projectId, costDate);
  }

  // ── Query 2: tasks del proyecto (resolve masterTaskId) ────────────────────
  const taskIds = [...new Set(biRows.map((r: any) => r.task_id as string))];

  const { data: taskRows, error: taskErr } = await client
    .from('tasks')
    .select('id, master_task_id')
    .in('id', taskIds);

  if (taskErr) throw new Error(`recalculateBudgetFromSupabase [tasks]: ${taskErr.message}`);

  // task_id → masterTaskId
  const taskToMaster = new Map<string, string>();
  for (const t of (taskRows ?? [])) {
    if (t.master_task_id) taskToMaster.set(t.id, t.master_task_id);
  }

  // ── Queries 3-6: MasterTasks + recursos ───────────────────────────────────
  const { tasksMap, resourcesMap, allResourceIds } = await loadCostEngineData(client, organizationId);

  // ── Queries 7-8: costos (snapshots + fallback) ────────────────────────────
  const costMap     = await bulkLoadCosts(client, organizationId, allResourceIds, costDate);
  const resolveCost = buildResolveCost(costMap);

  // Contadores de origen de datos
  let snapshotResources = 0;
  let fallbackResources = 0;
  for (const id of allResourceIds) {
    const src = costMap.sourceOf(id);
    if (src === 'SNAPSHOT')          snapshotResources++;
    else if (src === 'FALLBACK_BASE_COST') fallbackResources++;
  }

  // ── Contexto del motor (compartido entre todos los ítems) ─────────────────
  const ctx: RecursiveEngineContext = {
    organizationId,
    costDate,
    tasksMap,
    resourcesMap,
    resolveCost,
    visited:  new Set(),
    computed: new Map(),  // memoización: un MasterTask se calcula una sola vez
  };

  // ── Calcular cada ítem ────────────────────────────────────────────────────
  const items:        BudgetItemCost[] = [];
  let totalDirectCost = 0;
  let skippedItems    = 0;

  for (const bi of biRows) {
    const masterTaskId = taskToMaster.get(bi.task_id);
    const masterTask   = masterTaskId ? tasksMap.get(masterTaskId) : undefined;

    if (!masterTask) {
      skippedItems++;
      continue;
    }

    const unitCost  = await computeTaskCost(masterTask, ctx);
    const quantity  = bi.quantity ?? 1;
    const totalCost = round4(unitCost.totalUnitCost * quantity);

    items.push({
      budgetItemId: bi.id,
      taskId:       bi.task_id,
      masterTaskId,
      unitCost,
      quantity,
      totalCost,
    });
    totalDirectCost += totalCost;
  }

  return {
    projectId,
    costBase:        costDate,
    items,
    totalDirectCost: round4(totalDirectCost),
    computedAt:      new Date().toISOString(),
    skippedItems,
    fallbackResources,
    snapshotResources,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyResult(projectId: string, costDate: string): RecalcFromSupabaseResult {
  return {
    projectId,
    costBase:          costDate,
    items:             [],
    totalDirectCost:   0,
    computedAt:        new Date().toISOString(),
    skippedItems:      0,
    fallbackResources: 0,
    snapshotResources: 0,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
