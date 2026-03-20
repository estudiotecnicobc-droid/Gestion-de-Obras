/**
 * shared/client.ts
 * Cliente Supabase con service_role para scripts de automatización.
 * Carga credenciales desde env vars (NO usa .env.local — cargar antes de correr).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL             = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌  Falta env var: SUPABASE_URL');
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Falta env var: SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

export const sb: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Aborta el proceso con mensaje de error claro. */
export function abort(msg: string, err?: unknown): never {
  console.error(`\n❌  ${msg}`);
  if (err instanceof Error) console.error('   ', err.message);
  else if (err) console.error('   ', String(err));
  process.exit(1);
}

/** Parsea un argumento --flag valor de process.argv. */
export function getArg(flag: string, defaultVal?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : defaultVal;
}

/** Devuelve true si el flag está presente en process.argv. */
export function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}
