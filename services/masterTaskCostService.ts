import { MasterTask, MasterMaterial, LaborCategory, Tool } from '../types';

/**
 * Horas de jornada laboral por defecto para la Base Maestra de Tareas.
 * Se usa 9h fijo — independiente del proyecto activo.
 * Formula MO: (hourlyRate × WORKDAY_HOURS × cantTrabajadores) / dailyYield
 */
export const MASTER_WORKDAY_HOURS = 9;

export interface MasterTaskCostBreakdown {
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  fixedCost: number;
  totalUnitCost: number;
}

/**
 * Calcula el costo unitario completo de una MasterTask.
 *
 * Fórmulas:
 *   Mat  = Σ (quantity × price × (1 + wastePercent/100))
 *            price = masterMaterial.unitPrice ?? lastKnownUnitPrice ?? 0
 *
 *   MO   = Σ (cantTrabajadores × hourlyRate × workdayHours / dailyYield)
 *            hourlyRate = basicHourlyRate × (1 + (socialCharges + insurance) / 100)
 *            Solo se calcula si dailyYield > 0
 *
 *   Equ  = Σ (hoursPerUnit × tool.costPerHour)
 *
 *   Total = Mat + MO + Equ + fixedCost
 *
 * Función pura — no tiene side effects, no lee contexto global.
 */
export function calculateMasterTaskCost(
  task: MasterTask,
  masterMaterialsMap: Record<string, MasterMaterial>,
  laborCategoriesMap: Record<string, LaborCategory>,
  toolsMap: Record<string, Tool>,
  workdayHours: number = MASTER_WORKDAY_HOURS,
): MasterTaskCostBreakdown {
  // ── Materiales ──────────────────────────────────────────────────────────
  let materialCost = 0;
  for (const m of task.materials) {
    // Precio online (Supabase) tiene prioridad; si no disponible, usa el snapshot
    const livePrice = m.masterMaterialId
      ? masterMaterialsMap[m.masterMaterialId]?.unitPrice
      : undefined;
    const price = livePrice ?? m.lastKnownUnitPrice ?? 0;
    const wasteFactor = 1 + (m.wastePercent ?? 0) / 100;
    materialCost += price * m.quantity * wasteFactor;
  }

  // ── Mano de obra ────────────────────────────────────────────────────────
  let laborCost = 0;
  if ((task.dailyYield ?? 0) > 0) {
    for (const l of task.labor) {
      const cat = laborCategoriesMap[l.laborCategoryId];
      if (!cat) continue;
      const rate =
        (cat.basicHourlyRate || 0) *
        (1 + ((cat.socialChargesPercent || 0) + (cat.insurancePercent || 0)) / 100);
      laborCost += (rate * workdayHours * l.quantity) / task.dailyYield;
    }
  }

  // ── Equipos ─────────────────────────────────────────────────────────────
  let equipmentCost = 0;
  for (const e of task.equipment) {
    const tool = toolsMap[e.toolId];
    if (tool) equipmentCost += (tool.costPerHour || 0) * e.hoursPerUnit;
  }

  // ── Total ────────────────────────────────────────────────────────────────
  const fixedCost = task.fixedCost ?? 0;
  const totalUnitCost = materialCost + laborCost + equipmentCost + fixedCost;

  return {
    materialCost:  +materialCost.toFixed(2),
    laborCost:     +laborCost.toFixed(2),
    equipmentCost: +equipmentCost.toFixed(2),
    fixedCost:     +fixedCost.toFixed(2),
    totalUnitCost: +totalUnitCost.toFixed(2),
  };
}
