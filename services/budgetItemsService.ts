import { supabase } from './supabaseClient';
import { BudgetItem } from '../types';

// ─── Mappers ──────────────────────────────────────────────────────────────────

function budgetItemFromRow(row: Record<string, any>): BudgetItem {
  return {
    id: row.id,
    projectId: row.project_id,
    organizationId: row.organization_id ?? undefined,
    taskId: row.task_id,
    quantity: row.quantity ?? 1,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    manualDuration: row.manual_duration ?? undefined,
    status: row.status ?? undefined,
    dependencies: row.dependencies ?? undefined,
    progress: row.progress ?? undefined,
    crewsAssigned: row.crews_assigned ?? undefined,
    efficiencyFactor: row.efficiency_factor ?? undefined,
    allowancePercent: row.allowance_percent ?? undefined,
  };
}

function budgetItemToRow(item: BudgetItem): Record<string, any> {
  return {
    id: item.id,
    project_id: item.projectId,
    organization_id: item.organizationId ?? null,
    task_id: item.taskId,
    quantity: item.quantity,
    start_date: item.startDate ?? null,
    end_date: item.endDate ?? null,
    manual_duration: item.manualDuration ?? null,
    status: item.status ?? null,
    dependencies: item.dependencies ?? [],
    progress: item.progress ?? 0,
    crews_assigned: item.crewsAssigned ?? 1,
    efficiency_factor: item.efficiencyFactor ?? null,
    allowance_percent: item.allowancePercent ?? null,
  };
}

function buildUpdateRow(updates: Partial<BudgetItem>): Record<string, any> {
  const row: Record<string, any> = {};
  if (updates.quantity !== undefined)         row.quantity          = updates.quantity;
  if (updates.startDate !== undefined)        row.start_date        = updates.startDate;
  if (updates.endDate !== undefined)          row.end_date          = updates.endDate;
  if (updates.manualDuration !== undefined)   row.manual_duration   = updates.manualDuration;
  if (updates.status !== undefined)           row.status            = updates.status;
  if (updates.dependencies !== undefined)     row.dependencies      = updates.dependencies;
  if (updates.progress !== undefined)         row.progress          = updates.progress;
  if (updates.crewsAssigned !== undefined)    row.crews_assigned    = updates.crewsAssigned;
  if (updates.efficiencyFactor !== undefined) row.efficiency_factor = updates.efficiencyFactor;
  if (updates.allowancePercent !== undefined) row.allowance_percent = updates.allowancePercent;
  return row;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const budgetItemsService = {

  async listForProject(projectId: string): Promise<BudgetItem[]> {
    const { data, error } = await supabase
      .from('budget_items')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[budgetItemsService.list] Error al cargar budget_items:', {
        message: error.message, code: error.code, hint: error.hint, projectId,
      });
      return [];
    }
    console.log(`[BI:list] ✓ ${(data ?? []).length} items en DB para proyecto ${projectId}`,
      data?.length ? `task_ids: [${data.slice(0,3).map((r:any) => r.task_id?.slice(0,8)).join(', ')}...]` : '← DB VACÍO');
    return (data ?? []).map(budgetItemFromRow);
  },

  async create(item: BudgetItem): Promise<void> {
    const row = budgetItemToRow(item);
    const { error } = await supabase.from('budget_items').insert(row);
    if (error) {
      console.error('[budgetItemsService.create] error completo:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        row,
      });
      throw new Error(`[budgetItemsService.create] ${error.message}`);
    }
  },

  async update(id: string, updates: Partial<BudgetItem>): Promise<void> {
    const row = buildUpdateRow(updates);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('budget_items').update(row).eq('id', id);
    if (error) throw new Error(`[budgetItemsService.update] ${error.message}`);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('budget_items').delete().eq('id', id);
    if (error) throw new Error(`[budgetItemsService.remove] ${error.message}`);
  },

  async removeAllForProject(projectId: string): Promise<void> {
    const { error } = await supabase.from('budget_items').delete().eq('project_id', projectId);
    if (error) throw new Error(`[budgetItemsService.removeAllForProject] ${error.message}`);
  },
};
