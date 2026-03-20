import { useState, useEffect, useCallback } from 'react';
import { BudgetTemplate } from '../types';
import {
  budgetTemplatesService,
  BudgetTemplateInput,
} from '../services/budgetTemplatesSupabaseService';

/**
 * Hook de acceso a Plantillas de Presupuesto — Supabase.
 * Filtra por organizationId (multitenant).
 *
 * API expuesta:
 *   templates — plantillas activas de la org (con items ordenados por sort_order)
 *   loading   — true durante carga inicial y refetch
 *   error     — mensaje de error, null si OK
 *   add       — crea plantilla (async), devuelve la creada
 *   update    — actualiza por id (async)
 *   remove    — soft delete (async)
 *   refetch   — recarga manual desde Supabase
 */
export function useBudgetTemplates(organizationId: string) {
  const [templates, setTemplates] = useState<BudgetTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await budgetTemplatesService.list(organizationId);
      setTemplates(data);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar las plantillas.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const add = async (
    draft: Omit<BudgetTemplate, 'id' | 'organizationId' | 'isActive' | 'createdAt' | 'updatedAt'>,
  ): Promise<BudgetTemplate> => {
    const created = await budgetTemplatesService.create(organizationId, draft);
    setTemplates(prev => [...prev, created]);
    return created;
  };

  const update = async (
    id: string,
    updates: Partial<Omit<BudgetTemplate, 'id' | 'organizationId' | 'createdAt'>>,
  ): Promise<void> => {
    await budgetTemplatesService.update(id, updates);
    // Actualización optimista en state local
    setTemplates(prev =>
      prev.map(t =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
      ),
    );
  };

  const remove = async (id: string): Promise<void> => {
    await budgetTemplatesService.deactivate(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return { templates, loading, error, add, update, remove, refetch: fetchTemplates };
}
