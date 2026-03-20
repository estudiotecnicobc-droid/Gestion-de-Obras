// ─── Mock de costos por recurso y fecha ──────────────────────────────────────
// Simula dos snapshots: enero 2026 y marzo 2026 con ajuste por inflación.
// En producción esto vendría de get_resource_cost RPC (resource_cost_snapshots).

import {
  RES_CEMENTO,
  RES_ARENA,
  RES_LADRILLO,
  RES_OFICIAL,
  RES_AYUDANTE,
} from './mockData';

// Costos base (enero 2026, ARS por unidad base del recurso)
const COSTS_JAN_2026: Record<string, number> = {
  [RES_CEMENTO]:  79.49,  // $/KG
  [RES_ARENA]:    91.29,  // $/M3 (nota: M3 de arena ≈ 91.29)
  [RES_LADRILLO]:  0.4747, // $/UN
  [RES_OFICIAL]:  816.75,  // $/HS (tarifa horaria oficial)
  [RES_AYUDANTE]: 671.55,  // $/HS
};

// Costos marzo 2026 (~+8.7% materiales, +7.7% MO por ajuste UOCRA)
const COSTS_MAR_2026: Record<string, number> = {
  [RES_CEMENTO]:  86.32,  // +8.6%
  [RES_ARENA]:    99.14,  // +8.6%
  [RES_LADRILLO]:  0.5155, // +8.6%
  [RES_OFICIAL]:  879.86,  // +7.7%
  [RES_AYUDANTE]: 723.44,  // +7.7%
};

// Snapshot por mes: effective_date = primer día del mes
type Snapshot = Record<string, number>;

const SNAPSHOTS: { date: string; costs: Snapshot }[] = [
  { date: '2026-01-01', costs: COSTS_JAN_2026 },
  { date: '2026-03-01', costs: COSTS_MAR_2026 },
];

/**
 * Devuelve el costo del recurso a la fecha dada (lógica lte: snapshot <= costDate).
 * Simula el comportamiento de get_resource_cost en Supabase.
 */
export function getResourceUnitCost(
  resourceId: string,
  _orgId: string,
  costDate: string,
): number | null {
  // Ordenar snapshots desc para tomar el más reciente que sea <= costDate
  const sorted = [...SNAPSHOTS].sort((a, b) => b.date.localeCompare(a.date));
  const snapshot = sorted.find(s => s.date <= costDate);
  if (!snapshot) return null;
  return snapshot.costs[resourceId] ?? null;
}

/**
 * Factory que devuelve la función resolveCost para inyectar en RecursiveEngineContext.
 * Síncrono internamente, wrappado en Promise para cumplir la interfaz del motor.
 */
export function buildMockResolveCost(
  orgId: string,
  costDate: string,
): (resourceId: string) => Promise<number | null> {
  return async (resourceId: string) => getResourceUnitCost(resourceId, orgId, costDate);
}
