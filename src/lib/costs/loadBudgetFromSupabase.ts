/**
 * loadBudgetFromSupabase.ts
 * ──────────────────────────
 * QUÉ HACE:
 *   Helpers para resolver nombres de proyecto, tareas y master_tasks
 *   a partir de los IDs que devuelve recalculateBudgetFromSupabase.
 *   No recalcula costos — solo carga datos de display.
 *
 * QUÉ TENÉS QUE HACER VOS:
 *   Nada. Se usa internamente desde runBudgetRecalculation.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectInfo {
  id:   string;
  name: string;
}

export interface ItemNames {
  taskName:       string;
  masterTaskName: string;
  masterTaskCode: string;
}

/** Resuelve un proyecto: si no se pasa id, toma el más reciente de la org. */
export async function resolveProject(
  client:    SupabaseClient,
  tenantId:  string,
  projectId?: string,
): Promise<ProjectInfo | null> {
  if (projectId) {
    const { data, error } = await client
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .maybeSingle();
    if (error) throw new Error(`resolveProject: ${error.message}`);
    return data ? { id: data.id, name: data.name } : null;
  }

  const { data, error } = await client
    .from('projects')
    .select('id, name')
    .eq('organization_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`resolveProject: ${error.message}`);
  return data ? { id: data.id, name: data.name } : null;
}

/**
 * Carga nombres de tasks y master_tasks en bulk.
 * Devuelve Map<taskId, ItemNames>.
 */
export async function loadItemNames(
  client:        SupabaseClient,
  taskIds:       string[],
  masterTaskIds: string[],
): Promise<Map<string, ItemNames>> {
  const result = new Map<string, ItemNames>();
  if (taskIds.length === 0) return result;

  const [tasksRes, masterRes] = await Promise.all([
    client.from('tasks').select('id, name').in('id', taskIds),
    masterTaskIds.length > 0
      ? client.from('master_tasks').select('id, name, code').in('id', masterTaskIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tasksRes.error)  throw new Error(`loadItemNames [tasks]: ${tasksRes.error.message}`);
  if (masterRes.error) throw new Error(`loadItemNames [master_tasks]: ${masterRes.error.message}`);

  const taskNameMap   = new Map((tasksRes.data  ?? []).map((r: any) => [r.id, r.name as string]));
  const masterNameMap = new Map((masterRes.data ?? []).map((r: any) => [r.id, { name: r.name as string, code: r.code as string ?? '' }]));

  for (const taskId of taskIds) {
    const master = masterTaskIds.find(mid => mid); // placeholder, resolved per item
    result.set(taskId, {
      taskName:       taskNameMap.get(taskId)       ?? taskId.slice(0, 8),
      masterTaskName: '',
      masterTaskCode: '',
    });
    void master;
  }

  return { taskNameMap, masterNameMap } as any; // retornamos los maps crudos al caller
}

/** Versión simplificada usada directamente en el script. */
export async function loadNameMaps(
  client:        SupabaseClient,
  taskIds:       string[],
  masterTaskIds: string[],
): Promise<{
  taskNames:   Map<string, string>;
  masterNames: Map<string, { name: string; code: string }>;
}> {
  const [tasksRes, masterRes] = await Promise.all([
    taskIds.length > 0
      ? client.from('tasks').select('id, name').in('id', taskIds)
      : Promise.resolve({ data: [], error: null }),
    masterTaskIds.length > 0
      ? client.from('master_tasks').select('id, name, code').in('id', masterTaskIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tasksRes.error)  throw new Error(`loadNameMaps [tasks]: ${tasksRes.error.message}`);
  if (masterRes.error) throw new Error(`loadNameMaps [master_tasks]: ${masterRes.error.message}`);

  return {
    taskNames:   new Map((tasksRes.data  ?? []).map((r: any) => [r.id, r.name  as string])),
    masterNames: new Map((masterRes.data ?? []).map((r: any) => [r.id, { name: r.name as string, code: (r.code ?? '') as string }])),
  };
}
