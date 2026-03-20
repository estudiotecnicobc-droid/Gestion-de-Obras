/**
 * useBudgetCostComparison.ts
 * ───────────────────────────
 * QUÉ HACE:
 *   Hook que orquesta el recálculo de un presupuesto para dos fechas.
 *   Llama a recalculateBudgetFromSupabase dos veces (en paralelo) y
 *   devuelve los resultados con nombres de tareas resueltos.
 *
 * QUÉ TENÉS QUE HACER VOS:
 *   Nada. El componente BudgetCostComparisonPanel lo importa directamente.
 *   Solo asegurate de pasar projectId y organizationId (UUID real).
 */

import { useState, useCallback } from 'react';
import { supabase } from '../../../../services/supabaseClient';
import { recalculateBudgetFromSupabase } from '../../../lib/costs/recalculateBudgetFromSupabase';
import { loadNameMaps } from '../../../lib/costs/loadBudgetFromSupabase';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ComparisonItem {
  key:        string;   // masterTaskId ?? taskId
  name:       string;
  code:       string;
  quantity:   number;
  unitCostA:  number;
  unitCostB:  number;
  totalA:     number;
  totalB:     number;
  varPct:     number | null;  // null si unitCostA === 0
  warnings:   string[];
  // desglose por componente (por unidad)
  matCostA:   number;
  labCostA:   number;
  eqCostA:    number;
  matCostB:   number;
  labCostB:   number;
  eqCostB:    number;
  // componente de mayor costo unitario en A
  dominant:   'material' | 'labor' | 'equipment' | 'fixed' | null;
  // calidad del dato: usa snapshots reales, tarifa estática o datos incompletos
  costQuality: 'snapshot' | 'static' | 'incomplete';
}

export interface ComparisonResult {
  totalA:            number;
  totalB:            number;
  diff:              number;
  diffPct:           number | null;
  items:             ComparisonItem[];
  skippedItems:      number;
  snapshotResources: number;
  fallbackResources: number;
  computedAt:        string;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBudgetCostComparison(
  projectId:      string,
  organizationId: string,
) {
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = String(now.getMonth() + 1).padStart(2, '0');
  const today = `${y}-${m}-${String(now.getDate()).padStart(2, '0')}`;

  const [dateA,   setDateA]   = useState(`${y}-01-31`);
  const [dateB,   setDateB]   = useState(today);
  const [result,  setResult]  = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const recalculate = useCallback(async () => {
    if (!projectId || !organizationId) return;
    setLoading(true);
    setError(null);

    try {
      const [resA, resB] = await Promise.all([
        recalculateBudgetFromSupabase(supabase, { projectId, organizationId, costDate: dateA }),
        recalculateBudgetFromSupabase(supabase, { projectId, organizationId, costDate: dateB }),
      ]);

      // Cargar nombres de tareas y master_tasks
      const taskIds   = [...new Set(resA.items.map(i => i.taskId))];
      const masterIds = [...new Set([
        ...resA.items.map(i => i.masterTaskId),
        ...resB.items.map(i => i.masterTaskId),
      ].filter(Boolean) as string[])];

      const { taskNames, masterNames } = await loadNameMaps(supabase, taskIds, masterIds);

      // Mapear resultado B por key para comparar
      const mapB = new Map(resB.items.map(i => [i.masterTaskId ?? i.taskId, i]));

      const items: ComparisonItem[] = resA.items.map(itemA => {
        const key    = itemA.masterTaskId ?? itemA.taskId;
        const itemB  = mapB.get(key);
        const master = masterNames.get(itemA.masterTaskId ?? '');
        const name   = master?.name ?? taskNames.get(itemA.taskId) ?? key.slice(0, 8);
        const code   = master?.code ?? '';

        const unitCostA = itemA.unitCost.totalUnitCost;
        const unitCostB = itemB?.unitCost.totalUnitCost ?? 0;
        const varPct    = unitCostA > 0 ? ((unitCostB - unitCostA) / unitCostA) * 100 : null;

        const matCostA = itemA.unitCost.materialCost;
        const labCostA = itemA.unitCost.laborCost;
        const eqCostA  = itemA.unitCost.equipmentCost;
        const matCostB = itemB?.unitCost.materialCost  ?? 0;
        const labCostB = itemB?.unitCost.laborCost     ?? 0;
        const eqCostB  = itemB?.unitCost.equipmentCost ?? 0;

        const warnings = itemA.unitCost.warnings ?? [];

        const costQuality: ComparisonItem['costQuality'] =
          warnings.length > 0          ? 'incomplete' :
          varPct !== null && varPct !== 0 ? 'snapshot'   : 'static';

        const comps: { key: NonNullable<ComparisonItem['dominant']>; val: number }[] = [
          { key: 'material',  val: matCostA },
          { key: 'labor',     val: labCostA },
          { key: 'equipment', val: eqCostA  },
          { key: 'fixed',     val: itemA.unitCost.fixedCost ?? 0 },
        ];
        const topComp = comps.reduce((a, b) => b.val > a.val ? b : a, comps[0]);
        const dominant = topComp.val > 0 ? topComp.key : null;

        return {
          key,
          name,
          code,
          quantity:  itemA.quantity,
          unitCostA,
          unitCostB,
          totalA:    itemA.totalCost,
          totalB:    itemB?.totalCost ?? 0,
          varPct,
          warnings,
          matCostA, labCostA, eqCostA,
          matCostB, labCostB, eqCostB,
          dominant,
          costQuality,
        };
      });

      const diff    = resB.totalDirectCost - resA.totalDirectCost;
      const diffPct = resA.totalDirectCost > 0
        ? (diff / resA.totalDirectCost) * 100
        : null;

      setResult({
        totalA:            resA.totalDirectCost,
        totalB:            resB.totalDirectCost,
        diff,
        diffPct,
        items,
        skippedItems:      resA.skippedItems,
        snapshotResources: resA.snapshotResources,
        fallbackResources: resA.fallbackResources,
        computedAt:        resA.computedAt,
      });
    } catch (err: any) {
      setError(err.message ?? 'Error al recalcular');
    } finally {
      setLoading(false);
    }
  }, [projectId, organizationId, dateA, dateB]);

  return { dateA, setDateA, dateB, setDateB, result, loading, error, recalculate };
}
