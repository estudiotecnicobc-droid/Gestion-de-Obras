/**
 * seed-index-values.ts
 * --------------------
 * Carga valores de índices de costo (CAC, UOCRA, IPC, etc.) via upsert_index_value RPC.
 *
 * AUTOMATIZADO: idempotente, seguro de correr múltiples veces.
 * MANUAL: obtener los valores reales de INDEC/UOCRA/CAC y actualizar el JSON.
 *
 * Uso:
 *   npm run db:seed:indices
 *   npm run db:seed:indices -- --file scripts/cost-versioning/mis-indices-reales.json
 *
 * Env vars requeridas:
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 * Formato JSON esperado: ver index-values-sample.json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { sb, abort, getArg } from './shared/client.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface IndexValueEntry {
  index_code: string;
  year:       number;
  month:      number;
  value:      number;
  published_at?:  string; // YYYY-MM-DD
  source_ref?:    string; // URL o referencia
}

interface IndexValuesFile {
  _comment?: string;
  _source?:  string;
  values:    IndexValueEntry[];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const fileArg = getArg('--file', 'scripts/cost-versioning/index-values-sample.json');
  const filePath = resolve(process.cwd(), fileArg!);

  console.log('🌱  Seed: Valores de Índices de Costo\n');
  console.log(`   Archivo: ${filePath}`);

  let data: IndexValuesFile;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8')) as IndexValuesFile;
  } catch (e) {
    abort(`No se pudo leer el archivo de índices: ${filePath}`, e);
  }

  const entries = data.values;
  console.log(`   Entradas a procesar: ${entries.length}\n`);
  console.log('────────────────────────────────────────────────────────');

  let ok = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    const label = `${entry.index_code} ${entry.year}-${String(entry.month).padStart(2,'0')}`;

    const { data: resultId, error } = await sb.rpc('upsert_index_value', {
      p_index_code:   entry.index_code,
      p_year:         entry.year,
      p_month:        entry.month,
      p_value:        entry.value,
      p_published_at: entry.published_at ?? null,
      p_source_ref:   entry.source_ref ?? null,
      p_tenant_id:    null, // índices globales
    });

    if (error) {
      if (error.message.includes('no encontrado') || error.message.includes('P0002')) {
        console.log(`  ⚠  ${label}: índice no existe — verificar que migration 008 está aplicada`);
        skipped++;
      } else {
        console.error(`  ✗  ${label}: ${error.message}`);
        errors++;
      }
    } else {
      console.log(`  ✓  ${label} = ${entry.value}  (id: ${String(resultId).slice(0,8)}…)`);
      ok++;
    }
  }

  console.log('\n────────────────────────────────────────────────────────');
  console.log(`✅  Completado: ${ok} insertados/actualizados, ${skipped} omitidos, ${errors} errores`);

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌  Error inesperado:', err);
  process.exit(1);
});
