/**
 * runSupabaseCostDemo.ts
 * ───────────────────────
 * QUÉ HACE:
 *   Lee UNA master_task real desde Supabase y calcula su costo unitario
 *   para dos fechas (2026-01-31 y 2026-03-31) usando el motor recursivo.
 *   Imprime el mismo formato que la demo local (sin Supabase).
 *
 * QUÉ TENÉS QUE HACER VOS:
 *   1. Exportar variables de entorno:
 *        SUPABASE_URL=https://xxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   2. Correr:
 *        npm run demo:sb
 *      o para una tarea específica:
 *        npm run demo:sb -- --org <uuid> --task <uuid>
 *
 * PREREQUISITO:
 *   - Al menos una master_task activa en la org
 *   - Si tiene resource_id en sus sub-tablas: necesita resource_cost_snapshots
 *     o resources.base_cost como fallback
 *   - Si no tiene resource_id: usa lastKnownUnitPrice (precio capturado al crear)
 */

import { sb, abort, getArg } from '../cost-versioning/shared/client.js';
import { loadSupabaseDemoData } from '../../src/lib/costs/loadSupabaseDemoData.js';
import { bulkLoadCosts, buildResolveCost } from '../../src/lib/costs/supabaseCostService.js';
import { computeTaskCost } from '../../services/recursiveCostEngine.js';
import type { RecursiveEngineContext, RecursiveAPUResult } from '../../types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function printResult(label: string, costDate: string, r: RecursiveAPUResult) {
  console.log(`\n${'─'.repeat(58)}`);
  console.log(`  ${label}  |  Base de costo: ${costDate}`);
  console.log('─'.repeat(58));
  console.log(`  Materiales:   $${r.materialCost.toFixed(4)}`);
  console.log(`  Mano de obra: $${r.laborCost.toFixed(4)}`);
  console.log(`  Equipos:      $${r.equipmentCost.toFixed(4)}`);
  console.log(`  Fijo:         $${r.fixedCost.toFixed(4)}`);
  console.log(`  TOTAL/unidad: $${r.totalUnitCost.toFixed(4)}`);
  if (r.warnings?.length) {
    console.log(`  ⚠ Warnings:`);
    for (const w of r.warnings) console.log(`    · ${w}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const orgArg  = getArg('--org');
  const taskArg = getArg('--task');

  // ── Resolver org ─────────────────────────────────────────────────────────
  let tenantId: string;

  if (orgArg) {
    tenantId = orgArg;
    console.log(`\n🏗  Demo Motor Recursivo — Supabase`);
    console.log(`   Org: ${tenantId}`);
  } else {
    const { data: orgs, error } = await sb
      .from('organizations')
      .select('id, name')
      .order('name')
      .limit(1);

    if (error) abort('Error al listar organizaciones', error);
    if (!orgs?.length) abort('No hay organizaciones. Usa --org <uuid>.');

    tenantId = orgs[0].id;
    console.log(`\n🏗  Demo Motor Recursivo — Supabase`);
    console.log(`   Org: ${orgs[0].name} (${tenantId})`);
  }

  // ── Cargar tarea ─────────────────────────────────────────────────────────
  console.log(`   Tarea: ${taskArg ?? '(primera disponible)'}`);
  console.log('');
  console.log('⏳  Cargando desde Supabase...');

  const demoData = await loadSupabaseDemoData(sb, tenantId, taskArg);

  if (!demoData) {
    console.log('\n⚠  No se encontró ninguna master_task activa para esta org.');
    console.log('   Creá al menos un APU en la base maestra antes de correr la demo.');
    return;
  }

  const { task, tasksMap, resourcesMap, allResourceIds } = demoData;
  const label = `${task.code ? task.code + ' — ' : ''}${task.name} [${task.unit}]`;

  console.log(`   Tarea cargada:  "${task.name}" (${task.id})`);
  console.log(`   Sub-APUs:       ${tasksMap.size - 1}`);
  console.log(`   Recursos:       ${allResourceIds.length}`);

  // ── Calcular para 2026-01-31 ──────────────────────────────────────────────
  const DATE_A = '2026-01-31';
  const DATE_B = '2026-03-31';

  const costMapA = await bulkLoadCosts(sb, tenantId, allResourceIds, DATE_A);
  const costMapB = await bulkLoadCosts(sb, tenantId, allResourceIds, DATE_B);

  // Contextos independientes (memoización separada por fecha)
  const ctxA: RecursiveEngineContext = {
    organizationId: tenantId,
    costDate:       DATE_A,
    tasksMap,
    resourcesMap,
    resolveCost:    buildResolveCost(costMapA),
    visited:        new Set(),
    computed:       new Map(),
  };

  const ctxB: RecursiveEngineContext = {
    organizationId: tenantId,
    costDate:       DATE_B,
    tasksMap,
    resourcesMap,
    resolveCost:    buildResolveCost(costMapB),
    visited:        new Set(),
    computed:       new Map(),
  };

  const resultA = await computeTaskCost(task, ctxA);
  const resultB = await computeTaskCost(task, ctxB);

  // ── Imprimir ──────────────────────────────────────────────────────────────
  printResult(label, DATE_A, resultA);
  printResult(label, DATE_B, resultB);

  // ── Variación ─────────────────────────────────────────────────────────────
  const varPct = resultA.totalUnitCost === 0
    ? 'N/A'
    : (((resultB.totalUnitCost - resultA.totalUnitCost) / resultA.totalUnitCost) * 100)
        .toFixed(2) + '%';

  console.log(`\n${'═'.repeat(58)}`);
  console.log(`  Variación ${DATE_A} → ${DATE_B}`);
  console.log('─'.repeat(58));
  console.log(`  $${resultA.totalUnitCost.toFixed(4)}  →  $${resultB.totalUnitCost.toFixed(4)}  (${varPct})`);

  // Desglose de variación por componente
  if (resultA.totalUnitCost > 0) {
    const v = (a: number, b: number) =>
      a === 0 ? '  N/A  ' : `${((b - a) / a * 100) >= 0 ? '+' : ''}${((b - a) / a * 100).toFixed(2)}%`;
    console.log(`  Materiales:   ${v(resultA.materialCost,  resultB.materialCost)}`);
    console.log(`  Mano de obra: ${v(resultA.laborCost,     resultB.laborCost)}`);
    console.log(`  Equipos:      ${v(resultA.equipmentCost, resultB.equipmentCost)}`);
  }
  console.log('');
}

main().catch((err) => {
  console.error('\n❌  Error inesperado:', err);
  process.exit(1);
});
