/**
 * snapshotsGenerator.ts
 * ──────────────────────
 * Reemplaza el RPC generate_monthly_snapshots en TypeScript.
 *
 * Flujo:
 *   1. Fetch pricing rules activas del tenant (DISTINCT ON resource_id, mayor prioridad)
 *   2. Colectar todos los index_id referenciados (directos + formula_config)
 *   3. Fetch de TODOS los valores de esos índices en un solo query
 *   4. Calcular costo de cada recurso con pricingEngine.ts (puro, sin Supabase)
 *   5. Upsert de resultados en resource_cost_snapshots
 *
 * Virtud vs. RPC: cada paso es debuggeable individualmente.
 * Un error en un recurso no aborta los demás.
 */

import { sb } from '../shared/client.js';
import {
  PricingRule,
  IndexValueMap,
  buildIndexValueMap,
  calculateRuleCost,
  CalcResult,
  SnapshotSourceType,
} from './pricingEngine.js';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface GenerateResult {
  resourceId:   string;
  resourceCode: string;
  ruleType:     string;
  cost:         number | null;
  status:       'created' | 'skipped' | 'error';
  detail?:      string;
}

interface SnapshotRow {
  tenant_id:           string;
  resource_id:         string;
  effective_date:      string;
  cost:                number;
  currency:            string;
  source_type:         SnapshotSourceType;
  pricing_rule_id:     string;
  index_id:            string | null;
  index_base_value:    number | null;
  index_current_value: number | null;
  adjustment_factor:   number | null;
  metadata:            Record<string, unknown>;
}

// ── Step 1: Fetch pricing rules ───────────────────────────────────────────────

async function fetchPricingRules(tenantId: string): Promise<PricingRule[]> {
  const { data, error } = await sb
    .from('resource_pricing_rules')
    .select(`
      id, tenant_id, resource_id, rule_name, rule_type,
      index_id, base_date, base_cost, formula_config, is_active, priority,
      resources!inner ( code )
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('resource_id')
    .order('priority', { ascending: false });

  if (error) throw new Error(`fetchPricingRules: ${error.message}`);

  // DISTINCT ON resource_id: el primero por resource_id es el de mayor prioridad
  // (el order por priority DESC hace que el primero sea el correcto)
  const seen  = new Set<string>();
  const rules: PricingRule[] = [];

  for (const row of (data ?? [])) {
    if (seen.has(row.resource_id)) continue;
    seen.add(row.resource_id);

    rules.push({
      id:           row.id,
      tenantId:     row.tenant_id,
      resourceId:   row.resource_id,
      resourceCode: ((row.resources as unknown) as { code: string } | null)?.code ?? '???',
      ruleName:     row.rule_name,
      ruleType:     row.rule_type,
      indexId:      row.index_id  ?? null,
      baseDate:     row.base_date ?? null,
      baseCost:     row.base_cost != null ? Number(row.base_cost) : null,
      formulaConfig: (row.formula_config as Record<string, unknown>) ?? {},
      isActive:     row.is_active,
      priority:     row.priority,
    });
  }

  return rules;
}

// ── Step 2: Collect index IDs referenced by the rule set ─────────────────────

function collectIndexIds(rules: PricingRule[]): Set<string> {
  const ids = new Set<string>();

  for (const rule of rules) {
    // INDEX_MULTIPLIER: index_id directo
    if (rule.indexId) ids.add(rule.indexId);

    // LABOR_FORMULA: index_id dentro de formula_config
    if (rule.ruleType === 'LABOR_FORMULA') {
      const id = (rule.formulaConfig as { index_id?: string }).index_id;
      if (id) ids.add(id);
    }

    // COMPOSITE_INDEX: cada componente tiene su propio index_id
    if (rule.ruleType === 'COMPOSITE_INDEX') {
      const components = (rule.formulaConfig as { components?: Array<{ index_id: string }> }).components ?? [];
      for (const c of components) {
        if (c.index_id) ids.add(c.index_id);
      }
    }
  }

  return ids;
}

// ── Step 3: Fetch all needed index values in one query ────────────────────────

async function fetchIndexValues(indexIds: Set<string>): Promise<IndexValueMap> {
  if (indexIds.size === 0) return new Map();

  // Trae TODOS los valores históricos para esos índices.
  // Se filtra en memoria al calcular (lookupIndex usa year:month).
  // Dataset pequeño: un índice tiene ~12-60 valores anuales.
  const { data, error } = await sb
    .from('cost_index_values')
    .select('index_id, period_year, period_month, value')
    .in('index_id', [...indexIds]);

  if (error) throw new Error(`fetchIndexValues: ${error.message}`);

  return buildIndexValueMap(
    (data ?? []).map(r => ({
      index_id:     r.index_id,
      period_year:  r.period_year,
      period_month: r.period_month,
      value:        Number(r.value),
    })),
  );
}

// ── Step 4 (pre): Check which resources already have a snapshot ───────────────

async function fetchExistingResourceIds(
  tenantId:    string,
  resourceIds: string[],
  effDate:     string,
): Promise<Set<string>> {
  if (resourceIds.length === 0) return new Set();

  const { data, error } = await sb
    .from('resource_cost_snapshots')
    .select('resource_id')
    .eq('tenant_id', tenantId)
    .eq('effective_date', effDate)
    .neq('source_type', 'FALLBACK_BASE_COST')
    .in('resource_id', resourceIds);

  if (error) throw new Error(`fetchExistingResourceIds: ${error.message}`);

  return new Set((data ?? []).map(r => r.resource_id));
}

// ── Step 5: Upsert snapshots ──────────────────────────────────────────────────

async function upsertSnapshots(rows: SnapshotRow[], overwrite: boolean): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await sb
    .from('resource_cost_snapshots')
    .upsert(rows, {
      onConflict:       'tenant_id,resource_id,effective_date,source_type',
      // overwrite=true  → DO UPDATE (pisa el existente)
      // overwrite=false → DO NOTHING (defensa en profundidad, el skip ya filtró antes)
      ignoreDuplicates: !overwrite,
    });

  if (error) throw new Error(`upsertSnapshots: ${error.message}`);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Genera snapshots mensuales para un tenant.
 * Reemplaza el RPC generate_monthly_snapshots.
 *
 * @param tenantId  - UUID de la organización en Supabase
 * @param year      - año del período
 * @param month     - mes del período (1-12)
 * @param overwrite - true = sobreescribe snapshots existentes
 */
export async function generateSnapshotsForOrg(
  tenantId:  string,
  year:      number,
  month:     number,
  overwrite: boolean = false,
): Promise<GenerateResult[]> {
  const effDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const results: GenerateResult[] = [];

  // 1. Reglas activas
  const rules = await fetchPricingRules(tenantId);
  if (rules.length === 0) return [];

  // 2–3. Índices
  const indexIds = collectIndexIds(rules);
  const idxMap   = await fetchIndexValues(indexIds);

  console.log(`   Reglas: ${rules.length} | Índices referenciados: ${indexIds.size}`);

  // 4. Recursos ya con snapshot (skip cuando overwrite=false)
  const existing = overwrite
    ? new Set<string>()
    : await fetchExistingResourceIds(tenantId, rules.map(r => r.resourceId), effDate);

  // 5. Calcular
  const toUpsert: SnapshotRow[] = [];

  for (const rule of rules) {
    // Skip: ya tiene snapshot y no queremos sobreescribir
    if (!overwrite && existing.has(rule.resourceId)) {
      results.push({
        resourceId: rule.resourceId, resourceCode: rule.resourceCode,
        ruleType: rule.ruleType, cost: null, status: 'skipped',
      });
      continue;
    }

    // Skip: DIRECT_IMPORT requiere batch externo
    if (rule.ruleType === 'DIRECT_IMPORT') {
      results.push({
        resourceId: rule.resourceId, resourceCode: rule.resourceCode,
        ruleType: rule.ruleType, cost: null, status: 'skipped',
        detail: 'requiere importación directa',
      });
      continue;
    }

    // Calcular con el motor puro
    const calc: CalcResult = calculateRuleCost(rule, year, month, idxMap);

    if (calc.cost == null) {
      results.push({
        resourceId: rule.resourceId, resourceCode: rule.resourceCode,
        ruleType: rule.ruleType, cost: null, status: 'error', detail: calc.error,
      });
      continue;
    }

    toUpsert.push({
      tenant_id:           tenantId,
      resource_id:         rule.resourceId,
      effective_date:      effDate,
      cost:                calc.cost,
      currency:            'ARS',
      source_type:         calc.sourceType,
      pricing_rule_id:     rule.id,
      index_id:            calc.indexId            ?? null,
      index_base_value:    calc.indexBaseValue     ?? null,
      index_current_value: calc.indexCurrentValue  ?? null,
      adjustment_factor:   calc.adjustmentFactor   ?? null,
      metadata: {
        generated_by: 'ts:snapshotsGenerator',
        rule_name:    rule.ruleName,
        rule_type:    rule.ruleType,
      },
    });

    results.push({
      resourceId: rule.resourceId, resourceCode: rule.resourceCode,
      ruleType: rule.ruleType, cost: calc.cost, status: 'created',
    });
  }

  // 6. Upsert en bloque
  await upsertSnapshots(toUpsert, overwrite);

  return results;
}
