/**
 * generate-snapshots.ts
 * ----------------------
 * Genera snapshots mensuales de costos para todas las organizaciones
 * (o para una en particular) llamando a generate_monthly_snapshots RPC.
 *
 * AUTOMATIZADO: lógica de cálculo y persistencia de snapshots.
 * MANUAL: decidir qué mes generar y si sobreescribir snapshots existentes.
 *
 * Uso:
 *   npm run db:snapshots                        # mes actual, todas las orgs
 *   npm run db:snapshots -- --year 2026 --month 3
 *   npm run db:snapshots -- --year 2026 --month 3 --overwrite
 *   npm run db:snapshots -- --year 2026 --month 3 --org <uuid>
 *
 * Env vars:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { sb, abort, getArg, hasFlag } from './shared/client.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
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
  console.log(`\n📸  Generar snapshots: ${monthLabel}`);
  console.log(`   overwrite: ${overwrite ? 'SÍ (sobreescribe existentes)' : 'NO (respeta existentes)'}`);
  if (orgFilter) console.log(`   org: ${orgFilter}`);
  console.log('');

  // ── Obtener organizaciones ────────────────────────────────────────────────
  let orgIds: string[];

  if (orgFilter) {
    orgIds = [orgFilter];
  } else {
    const { data: orgs, error } = await sb
      .from('organizations')
      .select('id, name')
      .order('name');

    if (error) abort('Error al listar organizaciones', error);
    if (!orgs || orgs.length === 0) {
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

  // ── Generar snapshots por org ─────────────────────────────────────────────
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors  = 0;

  for (const orgId of orgIds) {
    console.log(`\n🏢  Org: ${orgId}`);

    const { data: results, error } = await sb.rpc('generate_monthly_snapshots', {
      p_tenant_id: orgId,
      p_year:      year,
      p_month:     month,
      p_overwrite: overwrite,
    });

    if (error) {
      console.error(`  ✗  Error: ${error.message}`);
      totalErrors++;
      continue;
    }

    if (!results || results.length === 0) {
      console.log('  ·  Sin reglas de pricing configuradas para esta org');
      continue;
    }

    const rows = results as { resource_code: string; rule_type: string; cost: number | null; status: string }[];
    let orgCreated = 0;
    let orgSkipped = 0;
    let orgErrors  = 0;

    for (const row of rows) {
      const costStr = row.cost != null ? `$${Number(row.cost).toFixed(4)}` : 'N/A';
      const icon = row.status === 'created'  ? '  ✓' :
                   row.status === 'skipped'  ? '  ·' : '  ✗';
      console.log(`${icon}  ${(row.resource_code ?? '???').padEnd(8)} [${row.rule_type}]  ${costStr}  — ${row.status}`);

      if (row.status === 'created')       orgCreated++;
      else if (row.status === 'skipped')  orgSkipped++;
      else                                orgErrors++;
    }

    console.log(`\n     Subtotal: ${orgCreated} creados, ${orgSkipped} omitidos, ${orgErrors} errores`);
    totalCreated += orgCreated;
    totalSkipped += orgSkipped;
    totalErrors  += orgErrors;
  }

  console.log('\n════════════════════════════════════════════════════════');
  console.log(`✅  ${monthLabel}: ${totalCreated} snapshots creados, ${totalSkipped} omitidos, ${totalErrors} errores`);
  console.log('');

  if (totalErrors > 0) {
    console.log('⚠  Algunos recursos tienen errores. Causas comunes:');
    console.log('   · Faltan valores de índice para este período → correr db:seed:indices');
    console.log('   · Recurso sin regla de pricing configurada');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n❌  Error inesperado:', err);
  process.exit(1);
});
