// ─── Recálculo completo de un presupuesto con base de costos ─────────────────
// Estrategia: 2 queries bulk → initialCostCache → motor sin RPCs individuales.
//
// Flujo:
//   1. Query resource_cost_snapshots (lte costBase) → dedup → costMap
//   2. Query resources (base_cost fallback para los que no tienen snapshot)
//   3. buildRecursiveCostEngine con initialCostCache pre-cargado
//   4. Por cada BudgetItem: Task → masterTaskId → MasterTask → computeTaskCost
//
// IMPORTANTE: organizationId debe ser UUID real (organizations.id).

import { supabase } from './supabaseClient';
import {
  BudgetItem,
  BudgetCostResult,
  BudgetItemCost,
  MasterTask,
  Task,
} from '../types';
import { buildRecursiveCostEngine } from './buildRecursiveCostEngine';
import { resourcesService } from './resourcesService';

export interface RecalculateParams {
  projectId:      string;
  organizationId: string;         // UUID real
  costBase:       string;         // YYYY-MM-DD último día del mes (ej: "2026-03-31")
  budgetItems:    BudgetItem[];
  tasks:          Task[];         // tareas del proyecto (tabla tasks)
  masterTasks:    MasterTask[];   // APUs maestros (tabla master_tasks)
}

export async function recalculateBudget(
  params: RecalculateParams,
): Promise<BudgetCostResult> {
  const { projectId, organizationId, costBase, budgetItems, tasks, masterTasks } = params;

  // ── Mapas de lookup ────────────────────────────────────────────────────────
  const tasksMap       = new Map(masterTasks.map(t => [t.id, t]));
  const projectTaskMap = new Map(tasks.map(t => [t.id, t]));

  // ── Query 1: snapshots vigentes (lte costBase) ─────────────────────────────
  // ORDER BY effective_date DESC → el primer resultado por resource_id es el más reciente.
  const { data: snapshots, error: snapErr } = await supabase
    .from('resource_cost_snapshots')
    .select('resource_id, cost')
    .eq('tenant_id', organizationId)
    .lte('effective_date', costBase)
    .order('effective_date', { ascending: false })
    .order('created_at',     { ascending: false });

  if (snapErr) {
    console.error('[recalculateBudget] Error cargando snapshots:', snapErr.message);
  }

  // Dedup: primer registro por resource_id = más reciente
  const costCache = new Map<string, number>();
  for (const row of snapshots ?? []) {
    if (!costCache.has(row.resource_id)) {
      costCache.set(row.resource_id, Number(row.cost));
    }
  }

  // ── Query 2: base_cost fallback para recursos sin snapshot ─────────────────
  const resourcesMap = await resourcesService.mapForOrg(organizationId);
  for (const [id, resource] of resourcesMap) {
    if (!costCache.has(id) && resource.baseCost > 0) {
      costCache.set(id, resource.baseCost);
    }
  }

  // ── Motor con cache pre-cargado (0 RPCs individuales) ─────────────────────
  const compute = buildRecursiveCostEngine({
    organizationId,
    costDate: costBase,
    tasksMap,
    resourcesMap,
    initialCostCache: costCache,
  });

  // ── Calcular cada ítem del presupuesto ─────────────────────────────────────
  const items: BudgetItemCost[] = [];
  let totalDirectCost = 0;

  for (const bi of budgetItems) {
    const projectTask = projectTaskMap.get(bi.taskId);
    const masterTaskId = projectTask?.masterTaskId;
    const masterTask = masterTaskId ? tasksMap.get(masterTaskId) : undefined;

    if (!masterTask) {
      // Tarea sin APU maestro vinculado — no se puede calcular con el motor nuevo
      continue;
    }

    const unitCost  = await compute(masterTask);
    const quantity  = bi.quantity ?? 1;
    const totalCost = round4(unitCost.totalUnitCost * quantity);

    items.push({
      budgetItemId: bi.id,
      taskId:       bi.taskId,
      masterTaskId,
      unitCost,
      quantity,
      totalCost,
    });
    totalDirectCost += totalCost;
  }

  return {
    projectId,
    costBase,
    items,
    totalDirectCost: round4(totalDirectCost),
    computedAt:      new Date().toISOString(),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
