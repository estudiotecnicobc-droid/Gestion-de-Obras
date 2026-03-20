/**
 * resourceCostResolver.ts
 * ────────────────────────
 * Resuelve el costo de un recurso para una fecha dada.
 * Reemplaza el RPC get_resource_cost en TypeScript.
 *
 * Lógica (idéntica al RPC):
 *   1. Snapshot más reciente con effective_date <= date (excluyendo FALLBACK)
 *   2. Si no existe → resources.base_cost
 *   3. Si tampoco → null
 *
 * Dos variantes:
 *   · resolveResourceCost()    — un solo recurso (N queries si se llama en loop)
 *   · bulkResolveResourceCosts() — muchos recursos, 2 queries totales (bulk)
 */

import { sb } from '../shared/client.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ResolvedCost {
  cost:           number;
  sourceType:     'SNAPSHOT' | 'FALLBACK_BASE_COST';
  snapshotId?:    string;
  effectiveDate?: string;  // YYYY-MM-DD del snapshot usado
}

// ── Single resource ───────────────────────────────────────────────────────────

/**
 * Resuelve el costo de UN recurso para una fecha.
 * Usar solo cuando se necesita un recurso puntual.
 * Para muchos recursos usar bulkResolveResourceCosts().
 */
export async function resolveResourceCost(
  resourceId: string,
  tenantId:   string,
  date:       string, // YYYY-MM-DD
): Promise<ResolvedCost | null> {
  // 1. Snapshot más reciente <= date
  const { data: snap, error: snapErr } = await sb
    .from('resource_cost_snapshots')
    .select('id, cost, effective_date')
    .eq('tenant_id', tenantId)
    .eq('resource_id', resourceId)
    .lte('effective_date', date)
    .neq('source_type', 'FALLBACK_BASE_COST')
    .order('effective_date', { ascending: false })
    .order('created_at',     { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapErr) throw new Error(`resolveResourceCost [snapshot]: ${snapErr.message}`);

  if (snap) {
    return {
      cost:          Number(snap.cost),
      sourceType:    'SNAPSHOT',
      snapshotId:    snap.id,
      effectiveDate: snap.effective_date,
    };
  }

  // 2. Fallback: base_cost del recurso
  const { data: res, error: resErr } = await sb
    .from('resources')
    .select('base_cost')
    .eq('id', resourceId)
    .maybeSingle();

  if (resErr) throw new Error(`resolveResourceCost [base_cost]: ${resErr.message}`);
  if (!res || res.base_cost == null) return null;

  return {
    cost:       Number(res.base_cost),
    sourceType: 'FALLBACK_BASE_COST',
  };
}

// ── Bulk ──────────────────────────────────────────────────────────────────────

/**
 * Interfaz de consulta para el resultado bulk.
 * Devuelve null si el recurso no tiene costo en ninguna fuente.
 */
export interface BulkCostMap {
  get(resourceId: string): number | null;
  sourceOf(resourceId: string): 'SNAPSHOT' | 'FALLBACK_BASE_COST' | 'NOT_FOUND';
  size(): number;
}

/**
 * Resuelve costos para MUCHOS recursos con solo 2 queries a Supabase.
 *
 * Query 1: todos los snapshots relevantes (dedup en memoria)
 * Query 2: base_cost para recursos sin snapshot
 *
 * Usar esto en recalculateBudget o scripts batch para evitar N+1.
 *
 * @param resourceIds - lista de IDs de recursos a resolver
 * @param tenantId    - UUID del tenant
 * @param date        - fecha tope (YYYY-MM-DD), usa snapshots <= esta fecha
 */
export async function bulkResolveResourceCosts(
  resourceIds: string[],
  tenantId:    string,
  date:        string,
): Promise<BulkCostMap> {
  if (resourceIds.length === 0) {
    return {
      get: ()       => null,
      sourceOf: ()  => 'NOT_FOUND',
      size: ()      => 0,
    };
  }

  const costMap   = new Map<string, number>();
  const sourceMap = new Map<string, 'SNAPSHOT' | 'FALLBACK_BASE_COST'>();

  // Query 1: snapshots
  // Traemos todos los snapshots vigentes para los recursos pedidos.
  // Ordenamos desc por effective_date y created_at → primer registro por
  // resource_id = el más reciente. Deduplicamos en memoria.
  const { data: snaps, error: snapErr } = await sb
    .from('resource_cost_snapshots')
    .select('resource_id, cost, effective_date')
    .eq('tenant_id', tenantId)
    .in('resource_id', resourceIds)
    .lte('effective_date', date)
    .neq('source_type', 'FALLBACK_BASE_COST')
    .order('effective_date', { ascending: false })
    .order('created_at',     { ascending: false });

  if (snapErr) throw new Error(`bulkResolveResourceCosts [snapshots]: ${snapErr.message}`);

  for (const row of (snaps ?? [])) {
    if (costMap.has(row.resource_id)) continue; // primer = más reciente
    costMap.set(row.resource_id, Number(row.cost));
    sourceMap.set(row.resource_id, 'SNAPSHOT');
  }

  // Query 2: fallback base_cost para los que no tienen snapshot
  const missing = resourceIds.filter(id => !costMap.has(id));

  if (missing.length > 0) {
    const { data: resources, error: resErr } = await sb
      .from('resources')
      .select('id, base_cost')
      .in('id', missing);

    if (resErr) throw new Error(`bulkResolveResourceCosts [base_cost]: ${resErr.message}`);

    for (const r of (resources ?? [])) {
      if (r.base_cost != null) {
        costMap.set(r.id, Number(r.base_cost));
        sourceMap.set(r.id, 'FALLBACK_BASE_COST');
      }
    }
  }

  return {
    get:      (id: string) => costMap.get(id)   ?? null,
    sourceOf: (id: string) => sourceMap.get(id) ?? 'NOT_FOUND',
    size:     ()           => costMap.size,
  };
}
