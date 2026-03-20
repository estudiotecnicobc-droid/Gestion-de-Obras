/**
 * runGenerateSnapshots.ts
 * ────────────────────────
 * CLI: genera snapshots mensuales usando el motor TypeScript.
 * No usa RPCs de Supabase — todo el cálculo ocurre en Node.
 *
 * Uso:
 *   npm run gen:snapshots
 *   npm run gen:snapshots -- --year 2026 --month 3
 *   npm run gen:snapshots -- --year 2026 --month 3 --overwrite
 *   npm run gen:snapshots -- --org <uuid>           # una organización
 *
 * Env vars requeridas (en .env.local o en la shell):
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 */

import { sb, abort, getArg, hasFlag } from './shared/client.js';
import { generateSnapshotsForOrg, GenerateResult } from './pricing/snapshotsGenerator.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { year: defaultYear, month: defaultMonth } = currentYearMonth();

  const year      = Number(getArg('--year',  String(defaultYear)));
  const month     = Number(getArg('--month', String(defaultMonth)));
  const overwrite = hasFlag('--overwrite');
  const orgFilter = getArg('--org');

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    abort(`Parámetros inválidos: --year ${year} --month ${month}`);
  }

  const monthLabel = `${year}-${pad(month)}`;

  console.log(`\n📸  Generar snapshots (TypeScript engine): ${monthLabel}`);
  console.log(`   Motor:     TypeScript (sin RPC)`);
  console.log(`   Overwrite: ${overwrite ? 'SÍ — sobreescribe existentes' : 'NO — respeta existentes'}`);
  if (orgFilter) console.log(`   Org:       ${orgFilter}`);
  console.log(`   Fecha:     ${new Date().toISOString()}`);
  console.log('');

  // ── Resolver organizaciones ───────────────────────────────────────────────
  let orgIds: string[];

  if (orgFilter) {
    orgIds = [orgFilter];
  } else {
    const { data: orgs, error } = await sb
      .from('organizations')
      .select('id, name')
      .order('name');

    if (error) abort('Error al listar organizaciones', error);
    if (!orgs?.length) {
      console.log('⚠  No hay organizaciones en la base de datos.');
      return;
    }

    console.log(`   Organizaciones encontradas: ${orgs.length}`);
    orgIds = orgs.map((o: { id: string; name: string }) => {
      console.log(`   · ${o.name} (${o.id})`);
      return o.id;
    });
  }

  console.log('\n────────────────────────────────────────────────────────');

  // ── Generar por org ───────────────────────────────────────────────────────
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors  = 0;

  for (const orgId of orgIds) {
    console.log(`\n🏢  Org: ${orgId}`);

    let results: GenerateResult[];
    try {
      results = await generateSnapshotsForOrg(orgId, year, month, overwrite);
    } catch (err: any) {
      console.error(`  ✗  Error inesperado: ${err.message}`);
      totalErrors++;
      continue;
    }

    if (results.length === 0) {
      console.log('  ·  Sin reglas de pricing configuradas');
      continue;
    }

    let orgCreated = 0;
    let orgSkipped = 0;
    let orgErrors  = 0;

    for (const r of results) {
      const costStr = r.cost != null ? `$${r.cost.toFixed(4)}` : 'N/A     ';
      const icon    = r.status === 'created' ? '  ✓' : r.status === 'skipped' ? '  ·' : '  ✗';
      const detail  = r.detail ? `  ← ${r.detail}` : '';
      const code    = r.resourceCode.padEnd(10);
      const type    = r.ruleType.padEnd(18);
      console.log(`${icon}  ${code} [${type}]  ${costStr}  — ${r.status}${detail}`);

      if      (r.status === 'created') orgCreated++;
      else if (r.status === 'skipped') orgSkipped++;
      else                             orgErrors++;
    }

    console.log(`\n     Subtotal: ${orgCreated} creados, ${orgSkipped} omitidos, ${orgErrors} errores`);
    totalCreated += orgCreated;
    totalSkipped += orgSkipped;
    totalErrors  += orgErrors;
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════');
  console.log(`✅  ${monthLabel}: ${totalCreated} snapshots creados, ${totalSkipped} omitidos, ${totalErrors} errores`);
  console.log('');

  if (totalErrors > 0) {
    console.log('⚠  Recursos con error. Causas comunes:');
    console.log('   · Falta valor de índice para el período → npm run db:seed:indices');
    console.log('   · formula_config mal estructurado en resource_pricing_rules');
    console.log('   · base_date o base_cost nulo en regla de tipo INDEX_MULTIPLIER');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌  Error inesperado:', err);
  process.exit(1);
});
