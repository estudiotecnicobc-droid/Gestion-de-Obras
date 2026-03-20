/**
 * supabaseCostService.ts
 * ───────────────────────
 * Resuelve costos de recursos desde Supabase, sin depender de RPCs.
 *
 * Estrategia (idéntica a bulkResolveResourceCosts del motor de scripts):
 *   1. Snapshots en resource_cost_snapshots con effective_date <= costDate
 *   2. Fallback: resources.base_cost para los que no tienen snapshot
 *
 * Acepta SupabaseClient como parámetro → reutilizable desde:
 *   · React frontend (anon key, supabaseClient.ts)
 *   · Scripts Node (service_role, scripts/cost-versioning/shared/client.ts)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type CostSourceType = 'SNAPSHOT' | 'FALLBACK_BASE_COST' | 'NOT_FOUND';

export interface BulkCostMap {
  get(resourceId: string): number | null;
  sourceOf(resourceId: string): CostSourceType;
  size(): number;
}

// ── Bulk ──────────────────────────────────────────────────────────────────────

/**
 * Carga costos para una lista de recursos con solo 2 queries a Supabase.
 *
 * @param client      - cliente Supabase (anon o service_role)
 * @param tenantId    - UUID de la organización
 * @param resourceIds - IDs de recursos a resolver
 * @param costDate    - fecha tope YYYY-MM-DD (snapshots con effective_date <= esta fecha)
 */
export async function bulkLoadCosts(
  client:      SupabaseClient,
  tenantId:    string,
  resourceIds: string[],
  costDate:    string,
): Promise<BulkCostMap> {
  if (resourceIds.length === 0) {
    return {
      get:      () => null,
      sourceOf: () => 'NOT_FOUND',
      size:     () => 0,
    };
  }

  const costMap   = new Map<string, number>();
  const sourceMap = new Map<string, 'SNAPSHOT' | 'FALLBACK_BASE_COST'>();

  // Query 1: snapshots vigentes (effective_date <= costDate, más reciente primero)
  const { data: snaps, error: snapErr } = await client
    .from('resource_cost_snapshots')
    .select('resource_id, cost')
    .eq('tenant_id', tenantId)
    .in('resource_id', resourceIds)
    .lte('effective_date', costDate)
    .neq('source_type', 'FALLBACK_BASE_COST')
    .order('effective_date', { ascending: false })
    .order('created_at',     { ascending: false });

  if (snapErr) throw new Error(`bulkLoadCosts [snapshots]: ${snapErr.message}`);

  for (const row of (snaps ?? [])) {
    if (costMap.has(row.resource_id)) continue; // primero = más reciente
    costMap.set(row.resource_id, Number(row.cost));
    sourceMap.set(row.resource_id, 'SNAPSHOT');
  }

  // Query 2: base_cost de recursos sin snapshot
  const missing = resourceIds.filter(id => !costMap.has(id));

  if (missing.length > 0) {
    const { data: resources, error: resErr } = await client
      .from('resources')
      .select('id, base_cost')
      .in('id', missing);

    if (resErr) throw new Error(`bulkLoadCosts [base_cost]: ${resErr.message}`);

    for (const r of (resources ?? [])) {
      if (r.base_cost != null) {
        costMap.set(r.id, Number(r.base_cost));
        sourceMap.set(r.id, 'FALLBACK_BASE_COST');
      }
    }
  }

  return {
    get:      (id) => costMap.get(id)   ?? null,
    sourceOf: (id) => sourceMap.get(id) ?? 'NOT_FOUND',
    size:     ()   => costMap.size,
  };
}

// ── Factory: resolveCost inyectable ──────────────────────────────────────────

/**
 * Devuelve la función `resolveCost` para inyectar en RecursiveEngineContext.
 *
 * Carga todos los costos de golpe (bulk) y retorna una closure que resuelve
 * cada recurso desde el mapa en memoria — 0 queries adicionales al motor.
 *
 * Uso:
 *   const costMap = await bulkLoadCosts(client, orgId, resourceIds, costDate);
 *   const resolveCost = buildResolveCost(costMap);
 *   const ctx = { ..., resolveCost, visited: new Set(), computed: new Map() };
 */
export function buildResolveCost(
  costMap: BulkCostMap,
): (resourceId: string) => Promise<number | null> {
  return async (resourceId: string) => costMap.get(resourceId);
}
