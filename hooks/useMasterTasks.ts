import { useState, useEffect, useCallback } from 'react';
import { MasterTask } from '../types';
import { masterTasksService, MasterTaskInput } from '../services/masterTasksSupabaseService';

/**
 * Hook de acceso a la Base Maestra de Tareas (APU) — Supabase.
 * Filtra por organizationId (multitenant).
 *
 * API expuesta:
 *   tasks    — tareas activas de la org
 *   loading  — true durante carga inicial y refetch
 *   error    — string con el mensaje de error, null si OK
 *   add      — crea tarea, devuelve la creada (async)
 *   update   — actualiza tarea por id (async)
 *   remove   — soft delete (async)
 *   refetch  — recarga manual desde Supabase
 */
export function useMasterTasks(organizationId: string) {
  const [tasks, setTasks] = useState<MasterTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await masterTasksService.list(organizationId);
      setTasks(data);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar las tareas maestras.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const add = async (
    draft: Omit<MasterTask, 'id' | 'organizationId' | 'isActive' | 'createdAt' | 'updatedAt'>,
  ): Promise<MasterTask> => {
    const input: MasterTaskInput = {
      ...draft,
      dailyYield: Math.max(0.01, draft.dailyYield),
    };
    const created = await masterTasksService.create(organizationId, input);
    setTasks(prev => [...prev, created]);
    return created;
  };

  const update = async (
    id: string,
    updates: Partial<Omit<MasterTask, 'id' | 'organizationId' | 'createdAt'>>,
  ): Promise<void> => {
    if (updates.dailyYield !== undefined) {
      updates = { ...updates, dailyYield: Math.max(0.01, updates.dailyYield) };
    }
    await masterTasksService.update(id, updates);
    // Actualización optimista: reemplazar solo la tarea editada en el state local
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t)),
    );
  };

  const remove = async (id: string): Promise<void> => {
    await masterTasksService.deactivate(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return { tasks, loading, error, add, update, remove, refetch: fetchTasks };
}
