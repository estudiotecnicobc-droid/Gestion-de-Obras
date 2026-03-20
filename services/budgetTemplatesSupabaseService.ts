import { supabase } from './supabaseClient';
import { BudgetTemplate, BudgetTemplateItem } from '../types';

// ─── Mappers snake_case ↔ camelCase ──────────────────────────────────────────

function itemFromRow(row: Record<string, any>): BudgetTemplateItem {
  return {
    masterTaskId: row.master_task_id,
    quantity: row.quantity != null ? Number(row.quantity) : undefined,
    sortOrder: Number(row.sort_order),
  };
}

function templateFromRow(
  row: Record<string, any>,
  items: BudgetTemplateItem[],
): BudgetTemplate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    items,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Tipo de entrada ──────────────────────────────────────────────────────────

export type BudgetTemplateInput = Omit<
  BudgetTemplate,
  'id' | 'organizationId' | 'isActive' | 'createdAt' | 'updatedAt'
>;

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const budgetTemplatesService = {

  /**
   * Devuelve todas las plantillas activas de la organización con sus items.
   * Items ordenados por sort_order.
   */
  async list(organizationId: string): Promise<BudgetTemplate[]> {
    const { data: templateRows, error } = await supabase
      .from('budget_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');
    if (error) throw new Error(error.message);
    if (!templateRows || templateRows.length === 0) return [];

    const ids = templateRows.map(r => r.id);

    const { data: itemRows, error: itemsError } = await supabase
      .from('budget_template_items')
      .select('*')
      .in('budget_template_id', ids)
      .order('sort_order');
    if (itemsError) throw new Error(itemsError.message);

    // Indexar items por budget_template_id
    const itemsMap: Record<string, BudgetTemplateItem[]> = {};
    for (const r of itemRows ?? []) {
      (itemsMap[r.budget_template_id] ??= []).push(itemFromRow(r));
    }

    return templateRows.map(r =>
      templateFromRow(r, itemsMap[r.id] ?? []),
    );
  },

  /**
   * Crea una plantilla con sus items.
   */
  async create(organizationId: string, input: BudgetTemplateInput): Promise<BudgetTemplate> {
    const { data: templateRow, error } = await supabase
      .from('budget_templates')
      .insert({
        organization_id: organizationId,
        name:            input.name,
        description:     input.description ?? null,
        category:        input.category ?? null,
        is_active:       true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await budgetTemplatesService._replaceItems(templateRow.id, input.items);

    return templateFromRow(templateRow, input.items);
  },

  /**
   * Estrategia de actualización: UPDATE padre + DELETE items previos + INSERT items nuevos.
   */
  async update(id: string, input: Partial<BudgetTemplateInput>): Promise<void> {
    const parentUpdates: Record<string, any> = {};
    if (input.name        !== undefined) parentUpdates.name        = input.name;
    if (input.description !== undefined) parentUpdates.description = input.description ?? null;
    if (input.category    !== undefined) parentUpdates.category    = input.category ?? null;

    if (Object.keys(parentUpdates).length > 0) {
      const { error } = await supabase
        .from('budget_templates')
        .update(parentUpdates)
        .eq('id', id);
      if (error) throw new Error(error.message);
    }

    if (input.items !== undefined) {
      await budgetTemplatesService._replaceItems(id, input.items);
    }
  },

  /** Soft delete: is_active = false */
  async deactivate(id: string): Promise<void> {
    const { error } = await supabase
      .from('budget_templates')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ── Internal helper ────────────────────────────────────────────────────────

  async _replaceItems(templateId: string, items: BudgetTemplateItem[]): Promise<void> {
    // Borrar todos los items previos
    const { error: delError } = await supabase
      .from('budget_template_items')
      .delete()
      .eq('budget_template_id', templateId);
    if (delError) throw new Error(delError.message);

    // Insertar los nuevos (solo si hay alguno)
    if (items.length === 0) return;

    const { error: insError } = await supabase
      .from('budget_template_items')
      .insert(
        items.map((item, idx) => ({
          budget_template_id: templateId,
          master_task_id:     item.masterTaskId,
          quantity:           item.quantity ?? null,
          sort_order:         item.sortOrder ?? idx,
        })),
      );
    if (insError) throw new Error(insError.message);
  },
};
