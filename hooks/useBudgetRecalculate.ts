/**
 * hooks/useBudgetRecalculate.ts
 *
 * Hook que orquesta el recálculo de un presupuesto con una base de costos.
 * Conecta ERPContext (tareas, ítems) → recalculateBudget → useBudgetCostStore.
 */

import { useCallback } from 'react';
import { useBudgetCostStore } from '../store/useBudgetCostStore';
import { recalculateBudget } from '../services/recalculateBudget';
import { BudgetItem, MasterTask, Task } from '../types';

interface RecalculateOptions {
  projectId:      string;
  organizationId: string;   // UUID real (organizations.id)
  costBase:       string;   // YYYY-MM-DD último día del mes
  budgetItems:    BudgetItem[];
  tasks:          Task[];
  masterTasks:    MasterTask[];
}

export function useBudgetRecalculate() {
  const { setResult, setComputing, setError } = useBudgetCostStore();

  const recalculate = useCallback(async (opts: RecalculateOptions) => {
    const { projectId } = opts;

    setComputing(projectId, true);
    setError(projectId, null);

    try {
      const result = await recalculateBudget(opts);
      setResult(projectId, result);
    } catch (err: any) {
      setError(projectId, err.message ?? 'Error en recálculo');
    } finally {
      setComputing(projectId, false);
    }
  }, [setResult, setComputing, setError]);

  return { recalculate };
}
