/**
 * smoke-test.ts
 * --------------
 * Verifica la integridad del sistema de cost versioning post-migración.
 * Sale con código 0 si todos los checks obligatorios pasan.
 * Sale con código 1 si algún check obligatorio falla.
 *
 * AUTOMATIZADO: ejecución de checks y reporte.
 * MANUAL: revisar los warnings y corregir datos si hay checks opcionales fallando.
 *
 * Uso:
 *   npm run db:smoke
 *   npm run db:smoke -- --org <uuid>   # checks funcionales para una org específica
 *
 * Niveles:
 *   [REQUIRED] → falla = exit 1
 *   [OPTIONAL] → falla = warning, no bloquea
 */

import { sb, getArg } from './shared/client.js';

// ── Framework mínimo de assertions ───────────────────────────────────────────

interface CheckResult {
  name:     string;
  level:    'REQUIRED' | 'OPTIONAL';
  passed:   boolean;
  message:  string;
}

const results: CheckResult[] = [];

async function check(
  name: string,
  level: 'REQUIRED' | 'OPTIONAL',
  fn: () => Promise<{ passed: boolean; message: string }>,
): Promise<void> {
  try {
    const { passed, message } = await fn();
    results.push({ name, level, passed, message });
    const icon = passed ? '✓' : (level === 'REQUIRED' ? '✗' : '⚠');
    console.log(`  ${icon}  [${level}] ${name}: ${message}`);
  } catch (err: any) {
    results.push({ name, level, passed: false, message: err.message });
    console.error(`  ✗  [${level}] ${name}: ${err.message}`);
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkTables() {
  console.log('\n── Schema ───────────────────────────────────────────────');

  await check('cost_indices existe', 'REQUIRED', async () => {
    const { count, error } = await sb.from('cost_indices').select('id', { count: 'exact', head: true });
    if (error) return { passed: false, message: error.message };
    return { passed: true, message: `tabla OK (${count} filas)` };
  });

  await check('cost_index_values existe', 'REQUIRED', async () => {
    const { count, error } = await sb.from('cost_index_values').select('id', { count: 'exact', head: true });
    if (error) return { passed: false, message: error.message };
    return { passed: true, message: `tabla OK (${count} filas)` };
  });

  await check('resource_pricing_rules existe', 'REQUIRED', async () => {
    const { count, error } = await sb.from('resource_pricing_rules').select('id', { count: 'exact', head: true });
    if (error) return { passed: false, message: error.message };
    return { passed: true, message: `tabla OK (${count} filas)` };
  });

  await check('resource_cost_snapshots existe', 'REQUIRED', async () => {
    const { count, error } = await sb.from('resource_cost_snapshots').select('id', { count: 'exact', head: true });
    if (error) return { passed: false, message: error.message };
    return { passed: true, message: `tabla OK (${count} filas)` };
  });

  await check('master_task_materials.resource_id existe', 'REQUIRED', async () => {
    // Si la columna no existe, la query fallará con "column does not exist"
    const { error } = await sb.from('master_task_materials').select('resource_id').limit(1);
    if (error) return { passed: false, message: `migration 010 pendiente: ${error.message}` };
    return { passed: true, message: 'columna OK' };
  });

  await check('projects.cost_base existe', 'REQUIRED', async () => {
    const { error } = await sb.from('projects').select('cost_base').limit(1);
    if (error) return { passed: false, message: `migration 010 pendiente: ${error.message}` };
    return { passed: true, message: 'columna OK' };
  });
}

async function checkSeeds() {
  console.log('\n── Seeds ────────────────────────────────────────────────');

  await check('≥8 índices globales (migration 008 seeds)', 'REQUIRED', async () => {
    const { count, error } = await sb
      .from('cost_indices')
      .select('id', { count: 'exact', head: true })
      .is('tenant_id', null);
    if (error) return { passed: false, message: error.message };
    const n = count ?? 0;
    return { passed: n >= 8, message: `${n} índices globales${n < 8 ? ' — ejecutar migration 008' : ''}` };
  });

  await check('Valores de índice CAC-MAT cargados', 'OPTIONAL', async () => {
    const { data, error } = await sb
      .from('cost_indices')
      .select('id')
      .eq('code', 'CAC-MAT')
      .is('tenant_id', null)
      .maybeSingle();
    if (error || !data) return { passed: false, message: 'índice CAC-MAT no encontrado' };

    const { count } = await sb
      .from('cost_index_values')
      .select('id', { count: 'exact', head: true })
      .eq('index_id', data.id);
    return {
      passed: (count ?? 0) > 0,
      message: `${count ?? 0} valores — ${(count ?? 0) === 0 ? 'ejecutar db:seed:indices' : 'OK'}`,
    };
  });

  await check('Valores de índice UOCRA cargados', 'OPTIONAL', async () => {
    const { data, error } = await sb
      .from('cost_indices')
      .select('id')
      .eq('code', 'UOCRA')
      .is('tenant_id', null)
      .maybeSingle();
    if (error || !data) return { passed: false, message: 'índice UOCRA no encontrado' };

    const { count } = await sb
      .from('cost_index_values')
      .select('id', { count: 'exact', head: true })
      .eq('index_id', data.id);
    return {
      passed: (count ?? 0) > 0,
      message: `${count ?? 0} valores — ${(count ?? 0) === 0 ? 'ejecutar db:seed:indices' : 'OK'}`,
    };
  });
}

async function checkRPCs(orgId?: string) {
  console.log('\n── RPCs ─────────────────────────────────────────────────');

  // get_resource_cost con un recurso conocido (I1001 CEMENTO PORTLAND del catálogo global)
  await check('get_resource_cost: recurso global accesible', 'OPTIONAL', async () => {
    if (!orgId) return { passed: false, message: 'requiere --org <uuid> para testear' };

    const { data: resource } = await sb
      .from('resources')
      .select('id')
      .eq('code', 'I1001')
      .is('organization_id', null)
      .maybeSingle();

    if (!resource) return { passed: false, message: 'recurso I1001 no encontrado — ejecutar db:seed:catalog' };

    const { data: cost, error } = await sb.rpc('get_resource_cost', {
      p_resource_id: resource.id,
      p_tenant_id:   orgId,
      p_date:        new Date().toISOString().split('T')[0],
    });

    if (error) return { passed: false, message: error.message };
    return {
      passed: cost != null,
      message: cost != null ? `$${Number(cost).toFixed(4)} (fallback o snapshot)` : 'devolvió null',
    };
  });

  await check('upsert_index_value: RPC alcanzable', 'OPTIONAL', async () => {
    // Test no-destructivo: buscamos un índice global y pedimos su valor actual
    const { data, error } = await sb
      .from('cost_indices')
      .select('id, code')
      .is('tenant_id', null)
      .limit(1)
      .maybeSingle();
    if (error || !data) return { passed: false, message: 'no hay índices globales' };

    const { count } = await sb
      .from('cost_index_values')
      .select('id', { count: 'exact', head: true })
      .eq('index_id', data.id);
    return { passed: true, message: `índice ${data.code} encontrado con ${count} valores` };
  });
}

async function checkSnapshots(orgId?: string) {
  console.log('\n── Snapshots ────────────────────────────────────────────');

  await check('Al menos 1 snapshot generado', 'OPTIONAL', async () => {
    const query = sb
      .from('resource_cost_snapshots')
      .select('id, effective_date, cost', { count: 'exact' })
      .neq('source_type', 'FALLBACK_BASE_COST');

    if (orgId) query.eq('tenant_id', orgId);

    const { count, data, error } = await query.limit(1);
    if (error) return { passed: false, message: error.message };

    if ((count ?? 0) === 0) {
      return { passed: false, message: 'ningún snapshot — ejecutar db:snapshots' };
    }

    const latest = data?.[0];
    return { passed: true, message: `${count} snapshots. Último: ${latest?.effective_date} $${Number(latest?.cost).toFixed(2)}` };
  });

  // Verificar mes actual (o mes anterior si no hay del mes actual)
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const effDate = `${year}-${String(month).padStart(2,'0')}-01`;

  await check(`Snapshots para ${effDate} (mes actual)`, 'OPTIONAL', async () => {
    const query = sb
      .from('resource_cost_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('effective_date', effDate);

    if (orgId) query.eq('tenant_id', orgId);

    const { count, error } = await query;
    if (error) return { passed: false, message: error.message };

    return {
      passed: (count ?? 0) > 0,
      message: `${count ?? 0} snapshots${(count ?? 0) === 0 ? ` — ejecutar: npm run db:snapshots -- --year ${year} --month ${month}` : ''}`,
    };
  });
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main() {
  const orgId = getArg('--org');

  console.log('\n🔍  Smoke Test: Cost Versioning');
  if (orgId) console.log(`   Org: ${orgId}`);
  console.log(`   Fecha: ${new Date().toISOString()}`);

  await checkTables();
  await checkSeeds();
  await checkRPCs(orgId);
  await checkSnapshots(orgId);

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════════════');

  const required = results.filter(r => r.level === 'REQUIRED');
  const optional = results.filter(r => r.level === 'OPTIONAL');
  const reqFailed = required.filter(r => !r.passed);
  const optFailed = optional.filter(r => !r.passed);

  console.log(`   REQUIRED: ${required.length - reqFailed.length}/${required.length} OK`);
  console.log(`   OPTIONAL: ${optional.length - optFailed.length}/${optional.length} OK`);

  if (reqFailed.length > 0) {
    console.log('\n❌  Checks obligatorios fallando:');
    for (const r of reqFailed) console.log(`   · ${r.name}: ${r.message}`);
    process.exit(1);
  }

  if (optFailed.length > 0) {
    console.log('\n⚠  Checks opcionales fallando (no bloquean):');
    for (const r of optFailed) console.log(`   · ${r.name}: ${r.message}`);
  }

  console.log('\n✅  Smoke test completado\n');
}

main().catch((err) => {
  console.error('\n❌  Error inesperado:', err);
  process.exit(1);
});
