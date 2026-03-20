/**
 * runCostDemo.ts
 * ──────────────
 * Demo local del motor recursivo de costos APU. Sin Supabase.
 *
 * Uso:
 *   npx tsx scripts/demo/runCostDemo.ts
 */

import { computeTaskCost } from '../../services/recursiveCostEngine';
import { RecursiveEngineContext } from '../../types';
import { TASKS_MAP, RESOURCES_MAP, TASK_MAM, TASK_MURO } from './mockData';
import { buildMockResolveCost } from './mockCostService';

const ORG_ID = 'demo-org';

function makeCtx(costDate: string): RecursiveEngineContext {
  return {
    organizationId: ORG_ID,
    costDate,
    tasksMap:     TASKS_MAP,
    resourcesMap: RESOURCES_MAP,
    resolveCost:  buildMockResolveCost(ORG_ID, costDate),
    visited:      new Set(),
    computed:     new Map(),
  };
}

function printResult(label: string, costDate: string, result: Awaited<ReturnType<typeof computeTaskCost>>) {
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  ${label}  |  Base de costo: ${costDate}`);
  console.log('─'.repeat(56));
  console.log(`  Materiales:   $${result.materialCost.toFixed(4)}`);
  console.log(`  Mano de obra: $${result.laborCost.toFixed(4)}`);
  console.log(`  Equipos:      $${result.equipmentCost.toFixed(4)}`);
  console.log(`  Fijo:         $${result.fixedCost.toFixed(4)}`);
  console.log(`  TOTAL/unidad: $${result.totalUnitCost.toFixed(4)}`);
  if (result.warnings?.length) {
    console.log(`  ⚠ Warnings:`);
    for (const w of result.warnings) console.log(`    · ${w}`);
  }
}

async function main() {
  console.log('\n🏗  Demo Motor Recursivo de Costos APU');
  console.log('   (sin Supabase — datos mockeados)\n');

  // ── Enero 2026 ──────────────────────────────────────────────────────────────
  const ctxJan = makeCtx('2026-01-31');

  const mamJan  = await computeTaskCost(TASK_MAM,  ctxJan);
  const muroJan = await computeTaskCost(TASK_MURO, ctxJan);

  printResult('Mampostería (TAREA-001)', '2026-01-31', mamJan);
  printResult('Muro revocado (TAREA-003)', '2026-01-31', muroJan);

  // ── Marzo 2026 ──────────────────────────────────────────────────────────────
  const ctxMar = makeCtx('2026-03-31');

  const mamMar  = await computeTaskCost(TASK_MAM,  ctxMar);
  const muroMar = await computeTaskCost(TASK_MURO, ctxMar);

  printResult('Mampostería (TAREA-001)', '2026-03-31', mamMar);
  printResult('Muro revocado (TAREA-003)', '2026-03-31', muroMar);

  // ── Variación ───────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(56)}`);
  console.log('  Variación enero → marzo 2026');
  console.log('─'.repeat(56));

  const mamVar  = ((mamMar.totalUnitCost  - mamJan.totalUnitCost)  / mamJan.totalUnitCost)  * 100;
  const muroVar = ((muroMar.totalUnitCost - muroJan.totalUnitCost) / muroJan.totalUnitCost) * 100;

  console.log(`  Mampostería:   $${mamJan.totalUnitCost.toFixed(2)} → $${mamMar.totalUnitCost.toFixed(2)}  (${mamVar >= 0 ? '+' : ''}${mamVar.toFixed(2)}%)`);
  console.log(`  Muro revocado: $${muroJan.totalUnitCost.toFixed(2)} → $${muroMar.totalUnitCost.toFixed(2)}  (${muroVar >= 0 ? '+' : ''}${muroVar.toFixed(2)}%)`);
  console.log('');
}

main().catch((err) => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
