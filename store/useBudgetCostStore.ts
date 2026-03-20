/**
 * store/useBudgetCostStore.ts
 *
 * Store Zustand para el recálculo de presupuestos con base de costos.
 *
 * Persistencia:
 *   · costBases (base seleccionada por proyecto) → localStorage
 *   · results (resultados calculados) → solo en memoria (se recalculan al recargar)
 *
 * Convención de costBase: último día del mes.
 *   "Base Marzo 2026" → costBase = "2026-03-31"
 *   La RPC get_resource_cost usa lte(costBase) → encuentra snapshots de effective_date=2026-03-01.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { BudgetCostResult } from '../types';

interface BudgetCostState {
  /** Base de costos seleccionada por proyecto: projectId → "YYYY-MM-DD" */
  costBases: Record<string, string>;
  /** Resultados calculados en sesión: projectId → BudgetCostResult */
  results:   Record<string, BudgetCostResult>;
  /** Proyectos con recálculo en curso */
  computing: Record<string, boolean>;
  /** Errores por proyecto */
  errors:    Record<string, string | null>;
}

interface BudgetCostActions {
  setCostBase:     (projectId: string, costBase: string) => void;
  setResult:       (projectId: string, result: BudgetCostResult) => void;
  setComputing:    (projectId: string, computing: boolean) => void;
  setError:        (projectId: string, error: string | null) => void;
  clearResult:     (projectId: string) => void;
}

type BudgetCostStore = BudgetCostState & BudgetCostActions;

export const useBudgetCostStore = create<BudgetCostStore>()(
  persist(
    (set) => ({
      // ── Estado inicial ──────────────────────────────────────────────────────
      costBases: {},
      results:   {},
      computing: {},
      errors:    {},

      // ── Actions ─────────────────────────────────────────────────────────────
      setCostBase(projectId, costBase) {
        set(s => ({ costBases: { ...s.costBases, [projectId]: costBase } }));
      },

      setResult(projectId, result) {
        set(s => ({ results: { ...s.results, [projectId]: result } }));
      },

      setComputing(projectId, computing) {
        set(s => ({ computing: { ...s.computing, [projectId]: computing } }));
      },

      setError(projectId, error) {
        set(s => ({ errors: { ...s.errors, [projectId]: error } }));
      },

      clearResult(projectId) {
        set(s => {
          const results   = { ...s.results };
          const computing = { ...s.computing };
          const errors    = { ...s.errors };
          delete results[projectId];
          delete computing[projectId];
          delete errors[projectId];
          return { results, computing, errors };
        });
      },
    }),
    {
      name: 'erp-budget-cost',
      storage: createJSONStorage(() => localStorage),
      // Solo persistir costBases — los resultados se recalculan al recargar
      partialize: (s) => ({ costBases: s.costBases }),
    },
  ),
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Genera el costBase (último día del mes) para un año/mes dado.
 * Ejemplo: costBaseFromMonth(2026, 3) → "2026-03-31"
 */
export function costBaseFromMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // día 0 del mes siguiente
  return d.toISOString().split('T')[0];
}

/**
 * Formatea un costBase para mostrar en UI.
 * Ejemplo: "2026-03-31" → "Base Marzo 2026"
 */
export function formatCostBase(costBase: string): string {
  const [year, month] = costBase.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return `Base ${date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`;
}
