import { supabase } from './supabaseClient';

export interface FetchResourceCostParams {
  resourceId:     string; // UUID del recurso
  organizationId: string; // UUID de organizations — DEBE ser UUID real, no ID legacy
  costDate:       string; // YYYY-MM-DD
}

/**
 * Llama a la RPC get_resource_cost(p_resource_id, p_tenant_id, p_date).
 * Devuelve el costo vigente o null si falla.
 *
 * La RPC devuelve:
 *   · snapshot más reciente con effective_date <= p_date (si existe)
 *   · resources.base_cost como fallback
 *
 * NOTA: no usar en loops por presupuesto completo — causa N+1.
 * Usar recalculateBudget.ts que pre-carga snapshots en bulk.
 */
export async function fetchResourceCost(
  params: FetchResourceCostParams,
): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_resource_cost', {
    p_resource_id: params.resourceId,
    p_tenant_id:   params.organizationId,
    p_date:        params.costDate,
  });

  if (error) {
    console.error(
      `[resourceCostService] get_resource_cost(${params.resourceId}, ${params.costDate}):`,
      error.message,
    );
    return null;
  }
  return data != null ? Number(data) : null;
}
