/**
 * services/budgetItemBreakdown.ts
 *
 * Capa de valorización comercial por ítem del presupuesto.
 *
 * RESPONSABILIDAD ÚNICA:
 *   Distribuir los componentes del Cuadro Empresario (GGD, GGI, Beneficio,
 *   Impuestos) en forma proporcional a la incidencia de cada ítem sobre el
 *   Costo Directo total, calculando así su Precio de Venta unitario y total.
 *
 * Esta capa NO duplica la lógica del Cuadro Empresario: recibe un BudgetKSummary
 * ya calculado (de computeBudgetKSummary / useBudgetSummary) y solo distribuye
 * los montos globales entre los ítems.
 *
 * FUNCIÓN PURA — sin dependencias de React, Zustand ni ERPContext.
 * Testeable de forma aislada con datos de ejemplo.
 *
 * ─── Fórmulas ────────────────────────────────────────────────────────────────
 *
 *   incidence       = item.directCostTotal / summary.directCost
 *                     (0 si directCost = 0)
 *
 *   ggdAllocated    = summary.ggdAmount    × incidence
 *   ggiAllocated    = summary.ggiAmount    × incidence
 *   profitAllocated = summary.profitAmount × incidence
 *   taxAllocated    = summary.taxAmount    × incidence
 *
 *   salePriceTotal  = directCostTotal
 *                   + ggdAllocated + ggiAllocated
 *                   + profitAllocated + taxAllocated
 *
 *   salePriceUnit   = salePriceTotal / quantity
 *                     (0 si quantity ≤ 0)
 *
 * ─── Residual por redondeo ────────────────────────────────────────────────────
 *
 *   Σ(salePriceTotal) ≈ summary.finalSalePrice con error de punto flotante
 *   (típicamente < 0.01 pesos para presupuestos normales). Para mostrar el
 *   total del presupuesto, usar siempre summary.finalSalePrice, no la suma
 *   de ítems. Ver nota al final del archivo.
 */

import { BudgetKSummary } from '../types';

// ─── Tipos de entrada / salida ────────────────────────────────────────────────

/**
 * Datos mínimos de costo directo que la función necesita por ítem.
 * Se construye a partir de los rows de budgetData en BudgetEditor
 * (o de ItemCost de useProjectSchedule, según el consumidor).
 */
export interface ItemDirectCostInput {
  /** ID del BudgetItem — se preserva en la salida para lookup O(1) */
  id: string;
  /** Cantidad del ítem */
  quantity: number;
  /** Costo directo unitario: materiales + MO + equipos (sin K) */
  directCostUnit: number;
  /** = directCostUnit × quantity */
  directCostTotal: number;
}

/**
 * Valorización comercial completa de un ítem:
 *   costo directo + porción proporcional del Cuadro Empresario → precio venta.
 */
export interface BudgetItemSaleBreakdown {
  // ── Identidad ───────────────────────────────────────────────────────────────
  id: string;
  quantity: number;

  // ── Costo Directo (pass-through de la entrada) ─────────────────────────────
  directCostUnit:  number;
  directCostTotal: number;

  // ── Incidencia en el presupuesto ───────────────────────────────────────────
  /** Fracción 0–1 de este ítem sobre el CD total. Suma 1 entre todos los ítems. */
  incidence: number;

  // ── Componentes del Cuadro Empresario (porción proporcional) ───────────────
  ggdAllocated:    number;
  ggiAllocated:    number;
  profitAllocated: number;
  taxAllocated:    number;

  // ── Precio de venta ─────────────────────────────────────────────────────────
  /** directCostTotal + todos los componentes asignados */
  salePriceTotal: number;
  /** salePriceTotal / quantity (0 si quantity ≤ 0) */
  salePriceUnit:  number;
}

// ─── Función pura ─────────────────────────────────────────────────────────────

/**
 * Calcula la valorización comercial de cada ítem distribuyendo los componentes
 * del Cuadro Empresario en forma proporcional a su incidencia de costo directo.
 *
 * @param items    Lista de ítems con su costo directo ya calculado.
 * @param summary  Cuadro Empresario global (de computeBudgetKSummary).
 *                 Se usa summary.directCost como denominador para la incidencia
 *                 (es el mismo valor que se usó para calcular el summary,
 *                 garantizando consistencia incluso si la suma de los items
 *                 difiere por centavos de punto flotante).
 *
 * @returns Array en el mismo orden que `items`, enriquecido con los campos
 *          de valorización comercial.
 */
export function computeBudgetItemSaleBreakdown(
  items: ItemDirectCostInput[],
  summary: BudgetKSummary,
): BudgetItemSaleBreakdown[] {
  // summary.directCost ya está sanitizado por computeBudgetKSummary
  // (nunca NaN, nunca negativo — ver useBudgetKStore.ts).
  const totalDC = summary.directCost;

  return items.map(item => {
    // ── Incidencia ──────────────────────────────────────────────────────────
    // Defensivo: 0 si CD total es 0 (presupuesto vacío o todos los ítems en 0).
    const incidence = totalDC > 0
      ? clamp01(item.directCostTotal / totalDC)
      : 0;

    // ── Distribución proporcional ───────────────────────────────────────────
    const ggdAllocated    = summary.ggdAmount    * incidence;
    const ggiAllocated    = summary.ggiAmount    * incidence;
    const profitAllocated = summary.profitAmount * incidence;
    const taxAllocated    = summary.taxAmount    * incidence;

    // ── Precio de venta ─────────────────────────────────────────────────────
    const salePriceTotal =
      item.directCostTotal +
      ggdAllocated +
      ggiAllocated +
      profitAllocated +
      taxAllocated;

    const salePriceUnit = item.quantity > 0
      ? salePriceTotal / item.quantity
      : 0;

    return {
      id:              item.id,
      quantity:        item.quantity,
      directCostUnit:  item.directCostUnit,
      directCostTotal: item.directCostTotal,
      incidence,
      ggdAllocated,
      ggiAllocated,
      profitAllocated,
      taxAllocated,
      salePriceTotal,
      salePriceUnit,
    };
  });
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Clampea a [0, 1] para prevenir incidencias fuera de rango por redondeo.
 * Ejemplo: si un ítem tiene costo ligeramente mayor al total CD (punto flotante),
 * la incidencia podría resultar en 1.0000000000000002 → se recorta a 1.
 */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/*
 * ─── NOTA SOBRE EL RESIDUAL DE REDONDEO ─────────────────────────────────────
 *
 * La distribución proporcional garantiza que:
 *   Σ(item.salePriceTotal) ≈ summary.finalSalePrice
 *
 * La diferencia es puramente de punto flotante (< 0.01 ARS en casos normales).
 * Para evitar inconsistencias en la impresión, la regla es:
 *
 *   • Los TOTALES de sección y del presupuesto completo deben leer
 *     de summary.finalSalePrice (la fuente de verdad del Cuadro Empresario).
 *
 *   • Los subtotales POR ÍTEM usan salePriceTotal (para que el ítem sea
 *     internamente consistente: salePriceUnit × quantity = salePriceTotal).
 *
 * Si en el futuro se necesita cuadrar exactamente (ej: impresión oficial),
 * se puede aplicar "last-item adjustment": sumar/restar el residual al
 * ítem de mayor incidencia. Por ahora no es necesario.
 * ─────────────────────────────────────────────────────────────────────────────
 */
