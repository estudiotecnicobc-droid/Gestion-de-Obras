/**
 * store/useCostEngineStore.ts
 *
 * Store Zustand (sin persistencia) para el motor de costos recursivo.
 * Gestiona: organizationId activa, costDate, y recursos cargados.
 *
 * Ciclo de vida:
 *   1. Al inicializar la app, llamar setOrganizationId(user.organizationId).
 *      Esto dispara loadResources() automáticamente.
 *   2. Al cambiar la fecha base de costos, llamar setCostDate('2026-03-31').
 *   3. Usar resourcesMap para pasar al motor vía buildRecursiveCostEngine.
 *
 * NOTA: organizationId DEBE ser el UUID real de organizations.id, no el ID legacy.
 */

import { create } from 'zustand';
import { Resource } from '../types';
import { resourcesService } from '../services/resourcesService';

interface CostEngineState {
  organizationId: string | null;
  costDate:       string;               // YYYY-MM-DD (último día del mes)
  resources:      Resource[];
  resourcesMap:   Map<string, Resource>;
  loading:        boolean;
  error:          string | null;
}

interface CostEngineActions {
  setOrganizationId: (orgId: string) => Promise<void>;
  setCostDate:       (date: string) => void;
  loadResources:     () => Promise<void>;
}

type CostEngineStore = CostEngineState & CostEngineActions;

const today = new Date();
const DEFAULT_COST_DATE = lastDayOfMonth(today.getFullYear(), today.getMonth() + 1);

export const useCostEngineStore = create<CostEngineStore>((set, get) => ({
  // ── Estado inicial ──────────────────────────────────────────────────────────
  organizationId: null,
  costDate:       DEFAULT_COST_DATE,
  resources:      [],
  resourcesMap:   new Map(),
  loading:        false,
  error:          null,

  // ── Actions ─────────────────────────────────────────────────────────────────
  async setOrganizationId(orgId: string) {
    set({ organizationId: orgId });
    await get().loadResources();
  },

  setCostDate(date: string) {
    set({ costDate: date });
  },

  async loadResources() {
    const { organizationId } = get();
    if (!organizationId) return;

    set({ loading: true, error: null });
    try {
      const resources = await resourcesService.listForOrg(organizationId);
      set({
        resources,
        resourcesMap: new Map(resources.map(r => [r.id, r])),
        loading: false,
      });
    } catch (err: any) {
      set({ loading: false, error: err.message ?? 'Error cargando recursos' });
    }
  },
}));

// ── Selectores ──────────────────────────────────────────────────────────────

export const selectCostDate      = (s: CostEngineStore) => s.costDate;
export const selectOrganizationId = (s: CostEngineStore) => s.organizationId;
export const selectResourcesMap  = (s: CostEngineStore) => s.resourcesMap;

// ── Helper: último día del mes ───────────────────────────────────────────────

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // día 0 del mes siguiente = último del mes actual
  return d.toISOString().split('T')[0];
}
