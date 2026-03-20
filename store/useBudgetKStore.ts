/**
 * store/useBudgetKStore.ts
 *
 * Store Zustand para el Cuadro Empresario / Coeficiente de Pase K.
 *
 * Coexiste con ERPContext: no lo reemplaza.
 * ERPContext sigue siendo fuente de verdad de items, tareas y recursos.
 * Este store gestiona únicamente los parámetros financieros (businessConfig)
 * con granularidad por proyecto (keyed by projectId).
 *
 * Persistencia: localStorage bajo la clave 'erp-budget-k'.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BusinessConfig, BudgetKSummary, PricingConfig } from '../types';

// ─── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Defaults conservadores para una empresa constructora típica argentina.
 * GGD 8% + GGI 7% = 15% total GG (equivale al generalExpensesPercent legacy).
 * El 3% financiero legacy se absorbe en GGI.
 */
export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  ggdPct:    0.08,  // 8%
  ggiPct:    0.07,  // 7%  (incluye financieros)
  profitPct: 0.10,  // 10%
  taxPct:    0.21,  // 21% IVA
};

// ─── Función pura de cálculo (testeable sin React ni Zustand) ─────────────────

/**
 * Calcula el Cuadro Empresario completo a partir de entradas puras.
 * No depende de hooks ni del store — puede usarse en tests unitarios,
 * workers, server-side o en cualquier utilidad sin React.
 *
 * @param directCost  Costo Directo total. Valores no finitos o negativos → 0.
 * @param config      BusinessConfig con porcentajes en decimal (0.08 = 8%).
 */
export function computeBudgetKSummary(
  directCost: number,
  config: BusinessConfig,
): BudgetKSummary {
  // Sanitizar entradas para garantizar resultados finitos
  const cd  = Number.isFinite(directCost) ? Math.max(0, directCost) : 0;
  const cfg = sanitizeConfig(config);

  const ggdAmount            = cd * cfg.ggdPct;
  const ggiAmount            = cd * cfg.ggiPct;
  const subtotalBeforeProfit = cd + ggdAmount + ggiAmount;
  const profitAmount         = subtotalBeforeProfit * cfg.profitPct;
  const subtotalBeforeTax    = subtotalBeforeProfit + profitAmount;
  const taxAmount            = subtotalBeforeTax * cfg.taxPct;
  const finalSalePrice       = subtotalBeforeTax + taxAmount;
  const kFactor              = cd > 0 ? finalSalePrice / cd : 1;

  return {
    directCost: cd,
    ggdAmount,
    ggiAmount,
    subtotalBeforeProfit,
    profitAmount,
    subtotalBeforeTax,
    taxAmount,
    finalSalePrice,
    kFactor,
    businessConfig: cfg,
  };
}

// ─── Tipos internos del store ──────────────────────────────────────────────────

type ConfigMap = Record<string, BusinessConfig>;

export interface BudgetKState {
  /** businessConfig indexado por projectId. */
  configs: ConfigMap;

  // ── Acciones ──────────────────────────────────────────────────────────────

  /** Reemplaza la config completa de un proyecto (sanitiza antes de guardar). */
  setConfig: (projectId: string, config: BusinessConfig) => void;

  /**
   * Actualiza un solo porcentaje.
   * El valor es clampeado a [0, +∞) — negativos y NaN son rechazados → 0.
   */
  updateGgdPct:    (projectId: string, value: number) => void;
  updateGgiPct:    (projectId: string, value: number) => void;
  updateProfitPct: (projectId: string, value: number) => void;
  updateTaxPct:    (projectId: string, value: number) => void;

  /**
   * Inicializa la config de un proyecto desde el PricingConfig legacy
   * (project.pricing). Solo actúa si el proyecto aún no tiene config K,
   * evitando sobreescribir ediciones posteriores del usuario.
   */
  initFromPricing: (projectId: string, pricing: PricingConfig | undefined) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBudgetKStore = create<BudgetKState>()(
  persist(
    (set, get) => ({
      configs: {},

      setConfig: (projectId, config) =>
        set(state => ({
          configs: { ...state.configs, [projectId]: sanitizeConfig(config) },
        })),

      updateGgdPct: (projectId, value) =>
        set(state => ({
          configs: patchConfig(state.configs, projectId, { ggdPct: clampPct(value) }),
        })),

      updateGgiPct: (projectId, value) =>
        set(state => ({
          configs: patchConfig(state.configs, projectId, { ggiPct: clampPct(value) }),
        })),

      updateProfitPct: (projectId, value) =>
        set(state => ({
          configs: patchConfig(state.configs, projectId, { profitPct: clampPct(value) }),
        })),

      updateTaxPct: (projectId, value) =>
        set(state => ({
          configs: patchConfig(state.configs, projectId, { taxPct: clampPct(value) }),
        })),

      initFromPricing: (projectId, pricing) => {
        // No sobreescribir si ya existe una config guardada para este proyecto.
        if (get().configs[projectId]) return;
        set(state => ({
          configs: {
            ...state.configs,
            [projectId]: migratePricingConfig(pricing),
          },
        }));
      },
    }),
    { name: 'erp-budget-k' },
  ),
);

// ─── Selector factory ─────────────────────────────────────────────────────────

/**
 * Selector estable por projectId para evitar re-renders cuando cambian
 * configs de otros proyectos.
 *
 * Uso en componente:
 *   const config = useBudgetKStore(selectBusinessConfig(project.id));
 */
export const selectBusinessConfig =
  (projectId: string) =>
  (state: BudgetKState): BusinessConfig =>
    state.configs[projectId] ?? DEFAULT_BUSINESS_CONFIG;

// ─── Helpers privados ─────────────────────────────────────────────────────────

/** Merge parcial seguro para un projectId, usando DEFAULT si no existe aún. */
function patchConfig(
  configs: ConfigMap,
  projectId: string,
  patch: Partial<BusinessConfig>,
): ConfigMap {
  const current = configs[projectId] ?? DEFAULT_BUSINESS_CONFIG;
  return { ...configs, [projectId]: { ...current, ...patch } };
}

/**
 * Clampea un porcentaje decimal a [0, +∞).
 * Rechaza NaN e Infinity → devuelve 0.
 * No impone límite superior: porcentajes > 1 son inusuales pero válidos (ej: 150% IIBB).
 */
function clampPct(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Sanitiza todos los campos de una BusinessConfig.
 * Garantiza que ningún campo sea NaN, Infinity o negativo.
 */
function sanitizeConfig(config: BusinessConfig): BusinessConfig {
  return {
    ggdPct:    clampPct(config.ggdPct),
    ggiPct:    clampPct(config.ggiPct),
    profitPct: clampPct(config.profitPct),
    taxPct:    clampPct(config.taxPct),
  };
}

/**
 * Migra PricingConfig (modelo viejo, valores en %) a BusinessConfig
 * (modelo K, valores en decimal 0-1).
 *
 * Convención de migración:
 *   generalExpensesPercent → repartido 50/50 entre ggdPct y ggiPct.
 *   financialExpensesPercent → sumado íntegramente a ggiPct.
 *
 * Ejemplo: generalExpenses=15%, financial=3% →
 *   ggdPct = 0.075, ggiPct = 0.075 + 0.03 = 0.105
 *
 * NOTA: usa Number.isFinite() en lugar de ??, porque ?? no atrapa NaN
 * (NaN ?? 15 === NaN). Valores inválidos caen al default numérico seguro.
 */
function migratePricingConfig(pricing: PricingConfig | undefined): BusinessConfig {
  if (!pricing) return DEFAULT_BUSINESS_CONFIG;

  const safeNum = (val: number, fallback: number): number =>
    Number.isFinite(val) ? val : fallback;

  const totalGGDecimal   = safeNum(pricing.generalExpensesPercent,  15) / 100;
  const financialDecimal = safeNum(pricing.financialExpensesPercent,  3) / 100;

  return sanitizeConfig({
    ggdPct:    totalGGDecimal / 2,
    ggiPct:    totalGGDecimal / 2 + financialDecimal,
    profitPct: safeNum(pricing.profitPercent, 10) / 100,
    taxPct:    safeNum(pricing.taxPercent,    21) / 100,
  });
}
