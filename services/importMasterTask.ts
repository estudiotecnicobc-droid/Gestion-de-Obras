/**
 * importMasterTask — servicio puro de importación de MasterTask al proyecto.
 *
 * No tiene side effects, no importa React, no lee contexto.
 * Solo construye el payload que el caller (MasterTasksPanel) escribe
 * usando las acciones ya expuestas por useERP().
 *
 * Entidades creadas:
 *   Task             ← clon de MasterTask con ID nuevo
 *   TaskLaborYield[] ← uno por cada MasterTaskLabor cuyo laborCategoryId exista
 *   TaskToolYield[]  ← uno por cada MasterTaskEquipment cuyo toolId exista
 *   BudgetItem       ← con quantity configurable, vinculado al proyecto activo
 *   Material[]       ← materiales nuevos creados por snapshot (si no existen por nombre)
 *   TaskYield[]      ← uno por cada MasterTaskMaterial, referenciando Material del proyecto
 */

import {
  MasterTask,
  Task,
  TaskYield,
  TaskLaborYield,
  TaskToolYield,
  BudgetItem,
  Material,
  LaborCategory,
  Tool,
} from '../types';
import { generateId } from '../utils/generateId';

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export interface ImportMasterTaskPayload {
  task: Task;
  /** Materiales nuevos a crear en el proyecto (no existían por nombre). */
  materialsToCreate: Material[];
  taskYields: TaskYield[];
  laborYields: TaskLaborYield[];
  toolYields: TaskToolYield[];
  budgetItem: BudgetItem;
  /** Líneas de MO omitidas porque el laborCategoryId no existe en el proyecto */
  skippedLabor: string[];
  /** Líneas de equipo omitidas porque el toolId no existe en el proyecto */
  skippedTools: string[];
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Construye el payload completo para importar una MasterTask al proyecto activo.
 *
 * @param masterTask          La tarea maestra origen
 * @param organizationId      El org ID del proyecto (para hidratar la Task y Material)
 * @param projectId           El project.id activo (para el BudgetItem)
 * @param quantity            Cantidad inicial del BudgetItem (default 1)
 * @param laborCategoriesMap  Mapa id→LaborCategory disponible en el proyecto
 * @param toolsMap            Mapa id→Tool disponible en el proyecto
 * @param projectMaterials    Lista actual de Material del proyecto (para lookup por nombre)
 */
export function buildImportPayload(
  masterTask: MasterTask,
  organizationId: string,
  projectId: string,
  quantity: number,
  laborCategoriesMap: Record<string, LaborCategory>,
  toolsMap: Record<string, Tool>,
  projectMaterials: Material[] = [],
): ImportMasterTaskPayload {
  // ── ID de la Task nueva ────────────────────────────────────────────────────
  const newTaskId = generateId();

  // ── dailyYield defensivo ───────────────────────────────────────────────────
  const dailyYield = Math.max(0.01, masterTask.dailyYield ?? 0.01);

  // ── Task ──────────────────────────────────────────────────────────────────
  const task: Task = {
    id: newTaskId,
    organizationId,
    name: masterTask.name,
    unit: masterTask.unit,
    dailyYield,
    laborCost: 0,
    category: masterTask.category ?? '',
    code: masterTask.code ?? '',
    description: masterTask.description ?? '',
    fixedCost: masterTask.fixedCost ?? 0,
    fixedCostDescription: masterTask.fixedCostDescription ?? '',
    specifications: masterTask.specifications ?? '',
    masterTaskId: masterTask.id,
  };

  // ── Materiales: lookup por nombre, crear si no existe ─────────────────────
  // Usamos un mapa local para no crear duplicados dentro de este mismo payload
  // (si el caller pasa projectMaterials actualizado entre llamadas, el dedup
  // funciona también a nivel bulk — ver importMasterRubro.ts).
  const localMaterialsMap = new Map<string, Material>(
    projectMaterials.map(m => [m.name, m]),
  );

  const materialsToCreate: Material[] = [];
  const taskYields: TaskYield[] = [];

  for (const mtm of masterTask.materials) {
    let material = localMaterialsMap.get(mtm.materialName);

    if (!material) {
      material = {
        id: generateId(),
        organizationId,
        name: mtm.materialName,
        unit: mtm.unit,
        cost: mtm.lastKnownUnitPrice ?? 0,
        family: 'MATERIAL',
      };
      materialsToCreate.push(material);
      // Registrar en el mapa local para deduplicar dentro de esta misma llamada
      localMaterialsMap.set(material.name, material);
    }

    taskYields.push({
      taskId: newTaskId,
      materialId: material.id,
      quantity: mtm.quantity,
      wastePercent: mtm.wastePercent,
    });
  }

  // ── TaskLaborYield — filtrar FKs inválidas ─────────────────────────────────
  const skippedLabor: string[] = [];
  const laborYields: TaskLaborYield[] = masterTask.labor
    .filter(l => {
      if (laborCategoriesMap[l.laborCategoryId]) return true;
      skippedLabor.push(l.laborCategoryName);
      return false;
    })
    .map(l => ({
      taskId: newTaskId,
      laborCategoryId: l.laborCategoryId,
      quantity: l.quantity,
    }));

  // ── TaskToolYield — filtrar FKs inválidas ─────────────────────────────────
  const skippedTools: string[] = [];
  const toolYields: TaskToolYield[] = masterTask.equipment
    .filter(e => {
      if (toolsMap[e.toolId]) return true;
      skippedTools.push(e.toolName);
      return false;
    })
    .map(e => ({
      taskId: newTaskId,
      toolId: e.toolId,
      hoursPerUnit: e.hoursPerUnit,
    }));

  // ── BudgetItem ────────────────────────────────────────────────────────────
  const budgetItem: BudgetItem = {
    id: generateId(),
    projectId,
    taskId: newTaskId,
    quantity: Math.max(1, quantity),
    status: 'pending',
    progress: 0,
  };

  return { task, materialsToCreate, taskYields, laborYields, toolYields, budgetItem, skippedLabor, skippedTools };
}
