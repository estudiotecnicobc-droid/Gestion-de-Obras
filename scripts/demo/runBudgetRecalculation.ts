/**
 * runBudgetRecalculation.ts
 * ──────────────────────────
 * QUÉ HACE:
 *   Toma un presupuesto real de Supabase y calcula su costo total
 *   para dos fechas distintas usando el motor recursivo.
 *   Imprime: nombre del presupuesto, costo total por fecha,
 *   diferencia absoluta y porcentual, top 5 ítems que más variaron.
 *
 * QUÉ TENÉS QUE HACER VOS:
 *   1. Exportar variables de entorno:
 *        SUPABASE_URL=https://xxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   2. Correr:
 *        npm run demo:budget
 *      o con org/proyecto específico:
 *        npm run demo:budget -- --org <uuid> --project <uuid>
 *
 * PREREQUISITOS:
 *   - Al menos un proyecto con budget_items en la org
 *   - Tasks vinculadas a master_tasks (masterTaskId)
 *   - master_task_labor/equipment con resource_id → resource_cost_snapshots
 *     (o snapshotHourlyRate/snapshotCostPerHour como fallback)
 */

import { sb, abort, getArg } from '../cost-versioning/shared/client.js';
import { recalculateBudgetFromSupabase }
  from '../../src/lib/costs/recalculateBudgetFromSupabase.js';
import type { RecalcFromSupabaseResult }
  from '../../src/lib/costs/recalculateBudgetFromSupabase.js';
import { resolveProject, loadNameMaps }
  from '../../src/lib/costs/loadBudgetFromSupabase.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function varPct(a: number, b: number): string {
  if (a === 0) return 'N/A';
  const v = ((b - a) / a) * 100;
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const orgArg     = getArg('--org');
  const projectArg = getArg('--project');
  const dateA      = getArg('--date-a', '2026-01-31')!;
  const dateB      = getArg('--date-b', '2026-03-31')!;

  // ── Resolver org ─────────────────────────────────────────────────────────
  let tenantId: string;

  if (orgArg) {
    tenantId = orgArg;
  } else {
    const { data: orgs, error } = await sb
      .from('organizations').select('id, name').order('name').limit(1);
    if (error) abort('Error al listar organizaciones', error);
    if (!orgs?.length) abort('No hay organizaciones. Usa --org <uuid>.');
    tenantId = orgs[0].id;
    console.log(`\n   Org: ${orgs[0].name} (${tenantId})`);
  }

  // ── Resolver proyecto ─────────────────────────────────────────────────────
  const project = await resolveProject(sb, tenantId, projectArg);
  if (!project) {
    console.log('\n⚠  No se encontró ningún proyecto para esta organización.');
    console.log('   Creá un proyecto con ítems de presupuesto antes de correr la demo.');
    return;
  }

  console.log(`\n💰  Presupuesto: "${project.name}"`);
  console.log(`   Fecha A: ${dateA}`);
  console.log(`   Fecha B: ${dateB}`);
  console.log('\n⏳  Calculando...');

  // ── Recalcular para ambas fechas ──────────────────────────────────────────
  const [resultA, resultB] = await Promise.all([
    recalculateBudgetFromSupabase(sb, { projectId: project.id, organizationId: tenantId, costDate: dateA }),
    recalculateBudgetFromSupabase(sb, { projectId: project.id, organizationId: tenantId, costDate: dateB }),
  ]);

  if (resultA.items.length === 0 && resultB.items.length === 0) {
    console.log('\n⚠  El presupuesto no tiene ítems con master_tasks vinculadas.');
    console.log(`   Ítems sin APU: ${resultA.skippedItems}`);
    console.log('   → Vinculá tasks del proyecto a MasterTask para calcular costos.');
    return;
  }

  // ── Cargar nombres ────────────────────────────────────────────────────────
  const allTaskIds   = [...new Set(resultA.items.map(i => i.taskId))];
  const allMasterIds = [...new Set([
    ...resultA.items.map(i => i.masterTaskId).filter(Boolean),
    ...resultB.items.map(i => i.masterTaskId).filter(Boolean),
  ] as string[])];

  const { taskNames, masterNames } = await loadNameMaps(sb, allTaskIds, allMasterIds);

  // ── Resumen principal ─────────────────────────────────────────────────────
  const diff    = resultB.totalDirectCost - resultA.totalDirectCost;
  const diffPct = varPct(resultA.totalDirectCost, resultB.totalDirectCost);

  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  ${project.name}`);
  console.log('─'.repeat(62));
  console.log(`  Ítems calculados:  ${resultA.items.length}`);
  console.log(`  Ítems sin APU:     ${resultA.skippedItems}  (sin masterTaskId)`);
  console.log(`  Recursos snapshot: ${resultA.snapshotResources}`);
  console.log(`  Recursos fallback: ${resultA.fallbackResources}  (base_cost)`);
  console.log('─'.repeat(62));
  console.log(`  Total ${dateA}:  $${fmt(resultA.totalDirectCost)}`);
  console.log(`  Total ${dateB}:  $${fmt(resultB.totalDirectCost)}`);
  console.log(`  Diferencia:          $${fmt(diff)}  (${diffPct})`);

  // ── Todos los ítems ───────────────────────────────────────────────────────
  if (resultA.items.length > 0) {
    console.log(`\n${'─'.repeat(62)}`);
    console.log('  Ítem                                   Ene          Mar       Var%');
    console.log('─'.repeat(62));

    const mapB = new Map(resultB.items.map(i => [i.masterTaskId ?? i.taskId, i]));

    for (const itemA of resultA.items) {
      const key   = itemA.masterTaskId ?? itemA.taskId;
      const itemB = mapB.get(key);
      const master = masterNames.get(itemA.masterTaskId ?? '');
      const label  = (master
        ? `${master.code ? master.code + ' ' : ''}${master.name}`
        : taskNames.get(itemA.taskId) ?? itemA.taskId.slice(0, 8)
      ).slice(0, 37).padEnd(37);

      const costAStr = `$${fmt(itemA.totalCost)}`.padStart(12);
      const costBStr = itemB ? `$${fmt(itemB.totalCost)}`.padStart(12) : '         N/A';
      const varStr   = itemB
        ? varPct(itemA.unitCost.totalUnitCost, itemB.unitCost.totalUnitCost).padStart(8)
        : '     N/A';
      const warn = itemA.unitCost.warnings?.length ? ' ⚠' : '';

      console.log(`  ${label}  ${costAStr}  ${costBStr}  ${varStr}${warn}`);
    }
  }

  // ── Top 5 ítems con mayor variación ──────────────────────────────────────
  const mapB = new Map(resultB.items.map(i => [i.masterTaskId ?? i.taskId, i]));

  const withVar = resultA.items
    .map(itemA => {
      const key   = itemA.masterTaskId ?? itemA.taskId;
      const itemB = mapB.get(key);
      if (!itemB || itemA.unitCost.totalUnitCost === 0) return null;
      const pct = ((itemB.unitCost.totalUnitCost - itemA.unitCost.totalUnitCost) /
                    itemA.unitCost.totalUnitCost) * 100;
      const absDiff = Math.abs(itemB.totalCost - itemA.totalCost);
      const master  = masterNames.get(itemA.masterTaskId ?? '');
      const name    = master
        ? `${master.code ? master.code + ' ' : ''}${master.name}`
        : taskNames.get(itemA.taskId) ?? itemA.taskId.slice(0, 8);
      return { name, pct, absDiff, totalA: itemA.totalCost, totalB: itemB.totalCost };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 5);

  if (withVar.length > 0) {
    console.log(`\n${'─'.repeat(62)}`);
    console.log('  Top 5 ítems con mayor variación:');
    console.log('─'.repeat(62));
    for (const item of withVar) {
      const name    = item.name.slice(0, 40).padEnd(40);
      const varStr  = `${item.pct >= 0 ? '+' : ''}${item.pct.toFixed(2)}%`.padStart(8);
      const diffStr = `Δ $${fmt(item.absDiff)}`;
      console.log(`  ${name}  ${varStr}  ${diffStr}`);
    }
  }

  console.log('');

  // ── Advertencias ─────────────────────────────────────────────────────────
  const warnings = [
    ...resultA.items.flatMap(i => i.unitCost.warnings ?? []),
    ...resultB.items.flatMap(i => i.unitCost.warnings ?? []),
  ];
  if (warnings.length > 0) {
    const unique = [...new Set(warnings)].slice(0, 5);
    console.log(`⚠  ${warnings.length} advertencias del motor (primeras ${unique.length}):`);
    for (const w of unique) console.log(`   · ${w}`);
    console.log('');
  }
}

main().catch(err => {
  console.error('\n❌  Error inesperado:', err);
  process.exit(1);
});
