/**
 * seedGlobalCatalog.ts
 * --------------------
 * Pobla el Catálogo Global Premium en Supabase con recursos reales
 * y un APU de ejemplo (Bases de H°A°, T1033).
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seedGlobalCatalog.ts
 *
 * Requiere:
 *   - Migración 001_global_catalog.sql ya ejecutada en Supabase
 *   - tsx en devDependencies (npm install -D tsx)
 *
 * Idempotente: puede ejecutarse múltiples veces sin duplicar datos.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Validación de entorno ────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌  Falta env var: SUPABASE_URL');
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Falta env var: SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Constantes ───────────────────────────────────────────────────────────────

const CATALOG_NAME = 'Global Premium v1';
const CATALOG_TYPE = 'global_premium';

const FAMILY_MAP: Record<string, string> = {
  'MATERIAL':    'MATERIAL',
  'MANO OBRA':   'LABOR',
  'EQUIPOS':     'EQUIPMENT',
  'SUBCONTRATO': 'SUBCONTRACT',
};

// ── Datos a sembrar ──────────────────────────────────────────────────────────

const SEED_RESOURCES = [
  { code: 'I1000', name: 'CAL HIDRÁULICA EN POLVO',                         unit: 'KG',  base_cost:    0.38, family: 'MATERIAL',    division: 'AGLOMERANTES' },
  { code: 'I1001', name: 'CEMENTO PORTLAND',                                 unit: 'KG',  base_cost:    0.50, family: 'MATERIAL',    division: 'AGLOMERANTES' },
  { code: 'I1002', name: 'ARENA x M3',                                       unit: 'M3',  base_cost:   82.69, family: 'MATERIAL',    division: 'ARIDO' },
  { code: 'I1003', name: 'LADRILLO COMUN',                                   unit: 'U',   base_cost:    0.43, family: 'MATERIAL',    division: 'LADRILLO' },
  { code: 'I1004', name: 'OFICIAL',                                           unit: 'HS',  base_cost:   21.05, family: 'MANO OBRA',   division: 'JORNALES' },
  { code: 'I1005', name: 'AYUDANTE',                                          unit: 'HS',  base_cost:   17.83, family: 'MANO OBRA',   division: 'JORNALES' },
  { code: 'I1008', name: 'RETROEXCAVADORA',                                   unit: 'HS',  base_cost:  250.00, family: 'EQUIPOS',     division: 'MAQUINARIA' },
  { code: 'I1009', name: 'ARENA GRUESA',                                      unit: 'M3',  base_cost:  100.00, family: 'MATERIAL',    division: 'ARIDO' },
  { code: 'I1010', name: 'CAL AEREA HIDRATADA EN POLVO',                      unit: 'KG',  base_cost:    0.66, family: 'MATERIAL',    division: 'AGLOMERANTES' },
  { code: 'I1011', name: 'ARENA FINA',                                        unit: 'M3',  base_cost:   65.00, family: 'MATERIAL',    division: 'ARIDO' },
  { code: 'I1012', name: 'LADRILLO HUECO 8X18X33',                            unit: 'U',   base_cost:    1.36, family: 'MATERIAL',    division: 'LADRILLO' },
  { code: 'I1013', name: 'LADRILLO HUECO 12X18X33',                           unit: 'U',   base_cost:    1.71, family: 'MATERIAL',    division: 'LADRILLO' },
  { code: 'I1014', name: 'LADRILLO HUECO 18X18X33',                           unit: 'U',   base_cost:    2.40, family: 'MATERIAL',    division: 'LADRILLO' },
  { code: 'I1015', name: 'HORMIGON ELABORADO H21 AS 7',                       unit: 'M3',  base_cost:  297.00, family: 'MATERIAL',    division: 'HORMIGON' },
  { code: 'I1016', name: 'HORMIGON ELABORADO H21 AS 15',                      unit: 'M3',  base_cost:  293.00, family: 'MATERIAL',    division: 'HORMIGON' },
  { code: 'I1017', name: 'SERVICIO DE BOMBEO',                                unit: 'M3',  base_cost:   15.00, family: 'SUBCONTRATO', division: 'HORMIGON' },
  { code: 'I1018', name: 'TRASLADO DE BOMBA HORMIGON',                        unit: 'SER', base_cost: 1600.00, family: 'SUBCONTRATO', division: 'HORMIGON' },
  { code: 'I1019', name: 'ACERO ADN420 DIAM 6 MM',                            unit: 'TON', base_cost: 4610.57, family: 'MATERIAL',    division: 'ACERO' },
  { code: 'I1020', name: 'ACERO ADN420 DIAM 8 MM',                            unit: 'TON', base_cost: 4770.85, family: 'MATERIAL',    division: 'ACERO' },
  { code: 'I1021', name: 'ACERO ADN420 DIAM 10 MM',                           unit: 'TON', base_cost:    0.00, family: 'MATERIAL',    division: 'ACERO' },
  { code: 'I1022', name: 'ACERO ADN420 DIAM 12 MM',                           unit: 'TON', base_cost: 5206.61, family: 'MATERIAL',    division: 'ACERO' },
  { code: 'I1023', name: 'ACERO ADN420 DIAM 16 MM',                           unit: 'TON', base_cost:    0.00, family: 'MATERIAL',    division: 'ACERO' },
  { code: 'I1024', name: 'ACERO ADN420 DIAM 20 MM',                           unit: 'TON', base_cost: 5162.91, family: 'MATERIAL',    division: 'ACERO' },
  { code: 'I1025', name: 'TABLA DE 1" SALIGNA BRUTO',                         unit: 'M2',  base_cost:   15.00, family: 'MATERIAL',    division: 'MADERAS' },
  { code: 'I1026', name: 'TIRANTE 3X3 SALIGNA BRUTO',                         unit: 'ML',  base_cost:    3.70, family: 'MATERIAL',    division: 'MADERAS' },
  { code: 'I1027', name: 'ALAMBRE NEGRO RECOCIDO N 16',                       unit: 'KG',  base_cost:    7.23, family: 'MATERIAL',    division: 'FERRETERIA' },
  { code: 'I1028', name: 'CLAVOS DE 2"',                                      unit: 'KG',  base_cost:    6.28, family: 'MATERIAL',    division: 'FERRETERIA' },
  { code: 'I1029', name: 'OFICIAL ESPECIALIZADO',                              unit: 'HS',  base_cost:   24.72, family: 'MANO OBRA',   division: 'JORNALES' },
  { code: 'I1030', name: 'OFICIAL HORMIGON',                                  unit: 'HS',  base_cost:   24.72, family: 'MANO OBRA',   division: 'JORNALES' },
  { code: 'I1031', name: 'AYUDANTE HORMIGON',                                 unit: 'HS',  base_cost:   19.62, family: 'MANO OBRA',   division: 'JORNALES' },
  { code: 'I1032', name: 'PIEDRA PARTIDA x M3',                               unit: 'M3',  base_cost:  233.55, family: 'MATERIAL',    division: 'ARIDO' },
  { code: 'I1033', name: 'DERECHO DE CONEXIÓN, AGUA EN ACERA 13 A 32 M U',    unit: 'U',   base_cost:  220.28, family: 'SUBCONTRATO', division: 'INST. AGUA' },
  { code: 'I1034', name: 'CAÑO ACQUA-LUMINUM PN-20 20 (1/2) TIRA x 4 mt',    unit: 'U',   base_cost:   41.75, family: 'MATERIAL',    division: 'ACQUA' },
  { code: 'I1035', name: 'CAÑO ACQUA-LUMINUM PN-20 25 (3/4) TIRA x 4 mt',    unit: 'U',   base_cost:   64.95, family: 'MATERIAL',    division: 'ACQUA' },
  { code: 'I1037', name: 'CAÑO ACQUA-LUMINUM PN-20 32 (1") TIRA x 4 mts',    unit: 'U',   base_cost:   95.74, family: 'MATERIAL',    division: 'ACQUA' },
  { code: 'I1038', name: 'CAÑO ACQUA-LUMINUM PN-20 40 (1 1/4) TIRA x 4 U',   unit: 'U',   base_cost:  148.49, family: 'MATERIAL',    division: 'ACQUA' },
] as const;

const APU_TASK = {
  code: 'T1033',
  name: 'Bases de H°A°',
  unit: 'M3',
} as const;

const APU_YIELDS = [
  { resourceCode: 'I1015', quantity: 1.05 },
  { resourceCode: 'I1004', quantity: 4.5  },
  { resourceCode: 'I1005', quantity: 4.5  },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function abort(msg: string, err?: unknown): never {
  console.error(`\n❌  ${msg}`);
  if (err instanceof Error) console.error('   ', err.message);
  else if (err) console.error('   ', err);
  process.exit(1);
}

/** Recupera o crea el catálogo global y devuelve su id. */
async function getOrCreateCatalog(): Promise<string> {
  const { data: existing, error: selErr } = await sb
    .from('catalogs')
    .select('id')
    .eq('name', CATALOG_NAME)
    .is('organization_id', null)
    .maybeSingle();

  if (selErr) abort('Error al consultar catalogs', selErr);

  if (existing) {
    console.log(`  ✓ Catálogo existente: "${CATALOG_NAME}" (${existing.id})`);
    return existing.id as string;
  }

  const { data: inserted, error: insErr } = await sb
    .from('catalogs')
    .insert({ name: CATALOG_NAME, type: CATALOG_TYPE, organization_id: null })
    .select('id')
    .single();

  if (insErr) abort('Error al crear el catálogo global', insErr);
  console.log(`  + Catálogo creado: "${CATALOG_NAME}" (${inserted!.id})`);
  return inserted!.id as string;
}

/**
 * Inserta los recursos que aún no existen en el catálogo.
 * Devuelve un mapa code → id de todos los recursos del catálogo.
 */
async function seedResources(catalogId: string): Promise<Map<string, string>> {
  // Leer todos los que ya existen en este catálogo
  const { data: existing, error: selErr } = await sb
    .from('resources')
    .select('id, code')
    .eq('catalog_id', catalogId);

  if (selErr) abort('Error al leer resources existentes', selErr);

  const codeToId = new Map<string, string>(
    (existing ?? []).map((r: { id: string; code: string }) => [r.code, r.id]),
  );

  const toInsert: Record<string, unknown>[] = [];

  for (const r of SEED_RESOURCES) {
    if (codeToId.has(r.code)) {
      console.log(`  ✓ Resource ya existe: ${r.code}  ${r.name}`);
      continue;
    }

    const type = FAMILY_MAP[r.family];
    if (!type) {
      console.warn(`  ⚠  Family inválida, omitiendo: ${r.code} (family="${r.family}")`);
      continue;
    }

    toInsert.push({
      catalog_id:         catalogId,
      organization_id:    null,
      code:               r.code,
      name:               r.name,
      unit:               r.unit,
      base_cost:          r.base_cost,
      type,
      category_name:      r.division,
      social_charges_pct: type === 'LABOR' ? 1.2094 : null,
      is_active:          true,
    });
  }

  if (toInsert.length > 0) {
    const { data: inserted, error: insErr } = await sb
      .from('resources')
      .insert(toInsert)
      .select('id, code');

    if (insErr) abort('Error al insertar resources', insErr);

    for (const r of inserted ?? []) {
      codeToId.set(r.code as string, r.id as string);
    }
    console.log(`  + ${toInsert.length} resources insertados`);
  }

  return codeToId;
}

/** Recupera o crea la master_task global y devuelve su id. */
async function getOrCreateMasterTask(): Promise<string> {
  const { data: existing, error: selErr } = await sb
    .from('master_tasks')
    .select('id')
    .eq('code', APU_TASK.code)
    .is('organization_id', null)
    .maybeSingle();

  if (selErr) abort('Error al consultar master_tasks', selErr);

  if (existing) {
    console.log(`  ✓ MasterTask existente: ${APU_TASK.code} "${APU_TASK.name}" (${existing.id})`);
    return existing.id as string;
  }

  const { data: inserted, error: insErr } = await sb
    .from('master_tasks')
    .insert({
      code:            APU_TASK.code,
      name:            APU_TASK.name,
      unit:            APU_TASK.unit,
      organization_id: null,
      daily_yield:     1,
      tags:            [],
      is_active:       true,
    })
    .select('id')
    .single();

  if (insErr) abort('Error al crear la master_task global', insErr);
  console.log(`  + MasterTask creada: ${APU_TASK.code} "${APU_TASK.name}" (${inserted!.id})`);
  return inserted!.id as string;
}

/** Inserta los yields que aún no existen para la task. */
async function seedYields(
  taskId: string,
  codeToId: Map<string, string>,
): Promise<void> {
  // Leer yields existentes para esta task
  const { data: existing, error: selErr } = await sb
    .from('catalog_task_yields')
    .select('resource_id')
    .eq('master_task_id', taskId);

  if (selErr) abort('Error al leer catalog_task_yields existentes', selErr);

  const existingResourceIds = new Set(
    (existing ?? []).map((y: { resource_id: string }) => y.resource_id),
  );

  const toInsert: Record<string, unknown>[] = [];

  for (const y of APU_YIELDS) {
    const resourceId = codeToId.get(y.resourceCode);

    if (!resourceId) {
      console.warn(`  ⚠  Resource no encontrado para yield: ${y.resourceCode} — omitido`);
      continue;
    }

    if (existingResourceIds.has(resourceId)) {
      console.log(`  ✓ Yield ya existe: ${y.resourceCode} × ${y.quantity}`);
      continue;
    }

    toInsert.push({
      master_task_id: taskId,
      resource_id:    resourceId,
      quantity:       y.quantity,
    });
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await sb
      .from('catalog_task_yields')
      .insert(toInsert);

    if (insErr) abort('Error al insertar catalog_task_yields', insErr);
    console.log(`  + ${toInsert.length} yields insertados`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱  Seed: Catálogo Global Premium\n');
  console.log('── Paso 1: Catálogo ─────────────────────────────────────');

  const catalogId = await getOrCreateCatalog();

  console.log('\n── Paso 2: Resources ────────────────────────────────────');
  const codeToId = await seedResources(catalogId);

  console.log('\n── Paso 3: Master Task (APU) ────────────────────────────');
  const taskId = await getOrCreateMasterTask();

  console.log('\n── Paso 4: Yields ───────────────────────────────────────');
  await seedYields(taskId, codeToId);

  console.log('\n✅  Seed completado exitosamente.');
  console.log(`   Catálogo: ${catalogId}`);
  console.log(`   Resources sembrados: ${codeToId.size}`);
  console.log(`   APU: ${APU_TASK.code} (${taskId})`);
}

main().catch((err) => {
  console.error('\n❌  Error inesperado:', err);
  process.exit(1);
});
