/**
 * pricingEngine.ts
 * ──────────────────
 * Motor de cálculo de costos — PURO, sin dependencias de Supabase.
 * Replica la lógica de generate_monthly_snapshots en TypeScript.
 *
 * Entrada:  PricingRule + IndexValueMap (pre-cargados)
 * Salida:   CalcResult (cost + trazabilidad)
 *
 * Tipos de regla soportados:
 *   FIXED_MANUAL      → cost = base_cost
 *   INDEX_MULTIPLIER  → cost = base_cost × (curr_idx / base_idx)
 *   LABOR_FORMULA     → cost = hourly_rate × hours × multiplier × (curr_idx / base_idx)
 *   COMPOSITE_INDEX   → cost = base_cost × Σ(weight × curr_idx / base_idx)
 *   DIRECT_IMPORT     → skip (requiere importación externa)
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type PricingRuleType =
  | 'FIXED_MANUAL'
  | 'DIRECT_IMPORT'
  | 'INDEX_MULTIPLIER'
  | 'COMPOSITE_INDEX'
  | 'LABOR_FORMULA';

export type SnapshotSourceType =
  | 'MANUAL'
  | 'INDEX_CALCULATION'
  | 'LABOR_CALCULATION'
  | 'COMPOSITE_CALCULATION';

export interface PricingRule {
  id:           string;
  tenantId:     string;
  resourceId:   string;
  resourceCode: string;
  ruleName:     string;
  ruleType:     PricingRuleType;
  indexId?:     string | null;
  baseDate?:    string | null; // YYYY-MM-DD — fecha de referencia del base_cost
  baseCost?:    number | null;
  formulaConfig: Record<string, unknown>;
  isActive:     boolean;
  priority:     number;
}

// IndexValueMap: indexId → "year:month" → value
// Se construye una sola vez y se reutiliza para todos los recursos.
export type IndexValueMap = Map<string, Map<string, number>>;

export interface CalcResult {
  cost:               number | null;
  sourceType:         SnapshotSourceType;
  indexId?:           string;      // índice principal usado en el cálculo
  indexBaseValue?:    number;      // valor del índice en base_date
  indexCurrentValue?: number;      // valor del índice en el período calculado
  adjustmentFactor?:  number;      // curr / base
  error?:             string;      // presente si cost === null
}

// ── Builders ──────────────────────────────────────────────────────────────────

/**
 * Construye IndexValueMap desde rows de la tabla cost_index_values.
 * Llamar una vez por ejecución con todos los índices necesarios.
 */
export function buildIndexValueMap(
  rows: { index_id: string; period_year: number; period_month: number; value: number }[],
): IndexValueMap {
  const map: IndexValueMap = new Map();
  for (const row of rows) {
    if (!map.has(row.index_id)) map.set(row.index_id, new Map());
    map.get(row.index_id)!.set(`${row.period_year}:${row.period_month}`, Number(row.value));
  }
  return map;
}

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Calcula el costo de un recurso según su regla de pricing activa.
 * @param rule   - regla de mayor prioridad del recurso
 * @param year   - año del período a calcular
 * @param month  - mes del período a calcular (1-12)
 * @param idxMap - mapa pre-cargado de valores de índice
 */
export function calculateRuleCost(
  rule:   PricingRule,
  year:   number,
  month:  number,
  idxMap: IndexValueMap,
): CalcResult {
  switch (rule.ruleType) {
    case 'FIXED_MANUAL':    return calcFixed(rule);
    case 'INDEX_MULTIPLIER': return calcIndexMultiplier(rule, year, month, idxMap);
    case 'LABOR_FORMULA':   return calcLaborFormula(rule, year, month, idxMap);
    case 'COMPOSITE_INDEX': return calcCompositeIndex(rule, year, month, idxMap);
    case 'DIRECT_IMPORT':
      return { cost: null, sourceType: 'MANUAL', error: 'DIRECT_IMPORT: requiere importación externa' };
    default:
      return { cost: null, sourceType: 'MANUAL', error: `tipo de regla desconocido: ${rule.ruleType}` };
  }
}

// ── Calculadores por tipo ─────────────────────────────────────────────────────

function calcFixed(rule: PricingRule): CalcResult {
  if (rule.baseCost == null) {
    return { cost: null, sourceType: 'MANUAL', error: 'FIXED_MANUAL: base_cost requerido' };
  }
  return { cost: rule.baseCost, sourceType: 'MANUAL' };
}

function calcIndexMultiplier(
  rule:   PricingRule,
  year:   number,
  month:  number,
  idxMap: IndexValueMap,
): CalcResult {
  if (!rule.indexId || !rule.baseDate || rule.baseCost == null) {
    return {
      cost: null, sourceType: 'INDEX_CALCULATION',
      error: 'INDEX_MULTIPLIER: requiere index_id, base_date y base_cost',
    };
  }

  // base_date determina el período de referencia del índice
  const base       = new Date(rule.baseDate + 'T00:00:00Z');
  const baseYear   = base.getUTCFullYear();
  const baseMonth  = base.getUTCMonth() + 1;

  const baseVal = lookupIndex(idxMap, rule.indexId, baseYear, baseMonth);
  const currVal = lookupIndex(idxMap, rule.indexId, year, month);

  if (baseVal == null || currVal == null || baseVal === 0) {
    return {
      cost: null, sourceType: 'INDEX_CALCULATION',
      error: `índice sin valor — base(${baseYear}-${pad(baseMonth)})=${baseVal} curr(${year}-${pad(month)})=${currVal}`,
    };
  }

  const factor = currVal / baseVal;
  return {
    cost:               round4(rule.baseCost * factor),
    sourceType:         'INDEX_CALCULATION',
    indexId:            rule.indexId,
    indexBaseValue:     baseVal,
    indexCurrentValue:  currVal,
    adjustmentFactor:   round4(factor),
  };
}

function calcLaborFormula(
  rule:   PricingRule,
  year:   number,
  month:  number,
  idxMap: IndexValueMap,
): CalcResult {
  // formula_config: { base_hourly_rate, hours_per_unit?, category_multiplier?, index_id, base_period: {year, month} }
  const cfg = rule.formulaConfig as {
    base_hourly_rate?:    number;
    hours_per_unit?:      number;
    category_multiplier?: number;
    index_id?:            string;
    base_period?:         { year: number; month: number };
  };

  const baseHourly = cfg.base_hourly_rate;
  const hours      = cfg.hours_per_unit      ?? 1;
  const multiplier = cfg.category_multiplier ?? 1;
  const indexId    = cfg.index_id;
  const basePeriod = cfg.base_period;

  if (!baseHourly || !indexId || !basePeriod?.year || !basePeriod?.month) {
    return {
      cost: null, sourceType: 'LABOR_CALCULATION',
      error: 'LABOR_FORMULA: formula_config requiere base_hourly_rate, index_id y base_period',
    };
  }

  const baseVal = lookupIndex(idxMap, indexId, basePeriod.year, basePeriod.month);
  const currVal = lookupIndex(idxMap, indexId, year, month);

  if (baseVal == null || currVal == null || baseVal === 0) {
    return {
      cost: null, sourceType: 'LABOR_CALCULATION',
      error: `índice laboral sin valor — base(${basePeriod.year}-${pad(basePeriod.month)})=${baseVal} curr(${year}-${pad(month)})=${currVal}`,
    };
  }

  const factor = currVal / baseVal;
  return {
    cost:               round4(baseHourly * hours * multiplier * factor),
    sourceType:         'LABOR_CALCULATION',
    indexId,
    indexBaseValue:     baseVal,
    indexCurrentValue:  currVal,
    adjustmentFactor:   round4(factor),
  };
}

function calcCompositeIndex(
  rule:   PricingRule,
  year:   number,
  month:  number,
  idxMap: IndexValueMap,
): CalcResult {
  // formula_config: { components: [{ index_id, weight, base_period: {year, month} }] }
  const cfg = rule.formulaConfig as {
    components?: Array<{
      index_id:    string;
      weight:      number;
      base_period: { year: number; month: number };
    }>;
  };

  if (!cfg.components?.length || rule.baseCost == null) {
    return {
      cost: null, sourceType: 'COMPOSITE_CALCULATION',
      error: 'COMPOSITE_INDEX: formula_config.components vacío o base_cost faltante',
    };
  }

  let weightedSum = 0;
  for (const comp of cfg.components) {
    const baseVal = lookupIndex(idxMap, comp.index_id, comp.base_period.year, comp.base_period.month);
    const currVal = lookupIndex(idxMap, comp.index_id, year, month);

    if (baseVal == null || currVal == null || baseVal === 0) {
      return {
        cost: null, sourceType: 'COMPOSITE_CALCULATION',
        error: `componente ${comp.index_id} sin valor — base(${comp.base_period.year}-${pad(comp.base_period.month)})=${baseVal} curr(${year}-${pad(month)})=${currVal}`,
      };
    }
    weightedSum += comp.weight * (currVal / baseVal);
  }

  return {
    cost:       round4(rule.baseCost * weightedSum),
    sourceType: 'COMPOSITE_CALCULATION',
  };
}

// ── Helpers internos ─────────────────────────────────────────────────────────

function lookupIndex(map: IndexValueMap, indexId: string, year: number, month: number): number | null {
  return map.get(indexId)?.get(`${year}:${month}`) ?? null;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
