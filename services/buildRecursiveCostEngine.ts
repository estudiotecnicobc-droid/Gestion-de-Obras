// ─── Factory del motor recursivo ─────────────────────────────────────────────
// Crea una función reutilizable por presupuesto que:
//   · Comparte un cache de costos pre-cargado (evita N+1 RPCs)
//   · Comparte memoización de resultados de MasterTask
//   · Inyecta el contexto completo en cada llamada

import { MasterTask, RecursiveAPUResult, RecursiveEngineContext, Resource } from '../types';
import { fetchResourceCost } from './resourceCostService';
import { computeTaskCost } from './recursiveCostEngine';

interface BuildParams {
  organizationId:    string;               // UUID real (organizations.id)
  costDate:          string;               // YYYY-MM-DD
  tasksMap:          Map<string, MasterTask>;
  resourcesMap?:     Map<string, Resource>;
  /**
   * Cache pre-cargado de costos por resourceId.
   * Clave: resourceId (UUID). Valor: costo para costDate.
   * Si el recurso no está en el cache, se llama fetchResourceCost (RPC individual).
   * Para presupuestos completos usar recalculateBudget.ts que pre-carga en bulk.
   */
  initialCostCache?: Map<string, number>;
}

/**
 * Devuelve una función `compute(task) → Promise<RecursiveAPUResult>`.
 * El cache de recursos y la memoización de resultados se comparten entre llamadas.
 */
export function buildRecursiveCostEngine(
  params: BuildParams,
): (task: MasterTask) => Promise<RecursiveAPUResult> {
  const { organizationId, costDate, tasksMap, resourcesMap } = params;

  // Cache de costos: resourceId → cost. Pre-cargado desde bulk query.
  const resourceCache = new Map<string, number>(params.initialCostCache ?? []);

  // resolveCost: cache-first, luego RPC individual
  async function resolveCost(resourceId: string): Promise<number | null> {
    if (resourceCache.has(resourceId)) {
      return resourceCache.get(resourceId)!;
    }
    const cost = await fetchResourceCost({ resourceId, organizationId, costDate });
    if (cost != null) resourceCache.set(resourceId, cost);
    return cost;
  }

  // Contexto compartido entre todas las llamadas (memoización + cycle detection)
  const ctx: RecursiveEngineContext = {
    organizationId,
    costDate,
    tasksMap,
    resourcesMap,
    resolveCost,
    visited:  new Set(),
    computed: new Map(),
  };

  return (task: MasterTask) => computeTaskCost(task, ctx);
}
