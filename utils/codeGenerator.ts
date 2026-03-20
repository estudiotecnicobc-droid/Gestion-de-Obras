/**
 * utils/codeGenerator.ts
 *
 * Helper reutilizable para sugerir códigos de catálogo (materiales maestros, APU).
 *
 * ─── Estrategia ───────────────────────────────────────────────────────────────
 *
 *   Formato:  {PREFIX}-{SEQ}
 *   PREFIX  = 3 chars de la categoría, normalizados (sin acentos, uppercase,
 *             solo alfanumérico). Si la categoría tiene menos de 3 chars útiles,
 *             se rellena con 'X'. Sin categoría → fallback configurable.
 *   SEQ     = número secuencial, calculado localmente sobre los códigos ya
 *             cargados en memoria que comparten el mismo prefijo.
 *
 *   Material:  {CAT}-{SEQ:04d}  → CEM-0001, HIE-0003, MAT-0001
 *   APU Task:  {CAT}-{SEQ:03d}  → MAM-001, HOR-002, APU-001
 *
 * ─── Riesgo de duplicados (Fase 1 — aceptado) ────────────────────────────────
 *
 *   La secuencia se calcula con los ítems cargados en memoria al momento de
 *   abrir el formulario. En un entorno multiusuario concurrente, dos sesiones
 *   abiertas simultáneamente podrían generar el mismo código.
 *
 *   Impacto: bajo. El campo `code` es informativo (no tiene UNIQUE constraint
 *   en DB en esta fase), y el usuario siempre puede editarlo manualmente antes
 *   de guardar.
 *
 *   Fase 2 (pendiente): resolver con una secuencia atómica en DB
 *   (función SQL `nextval` o RPC `get_next_code(prefix, org_id)`).
 *
 * ─── Funciones exportadas ────────────────────────────────────────────────────
 *
 *   normalizeText(s)                    → string uppercase sin acentos ni símbolos
 *   categoryPrefix(primary, fallback)   → string 3 chars, siempre mayúsculas
 *   nextSequence(prefix, codes)         → number (1-based, max existente + 1)
 *   suggestMaterialCode(cat, codes)     → string  e.g. "CEM-0001"
 *   suggestTaskCode(cat, codes)         → string  e.g. "MAM-001"
 */

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Elimina diacríticos (acentos, ñ, ü, etc.), pasa a mayúsculas y retiene
 * únicamente caracteres alfanuméricos ASCII.
 *
 * Ejemplos:
 *   "Mampostería"  → "MAMPOSTERIAS" (ó sin acento → O, í → I)
 *   "Hormigón"     → "HORMIGON"
 *   "Señalética"   → "SENALETICA"
 *   "PVC / Caños"  → "PVCCANIOS"   (barra y espacio eliminados)
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // eliminar diacríticos combinados
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');      // solo alfanumérico ASCII
}

/**
 * Genera un prefijo de exactamente 3 caracteres alfanuméricos en mayúsculas.
 *
 * Lógica de prioridad:
 *  1. Toma los primeros 3 chars útiles de `primary` normalizado.
 *  2. Si `primary` tiene menos de 3 chars útiles, rellena con 'X'.
 *  3. Si `primary` está vacío, aplica el mismo proceso a `fallback`.
 *
 * @param primary  Texto principal (e.g. categoría: "Cemento", "Mampostería")
 * @param fallback Texto alternativo si primary es vacío (e.g. "MAT", "APU")
 */
export function categoryPrefix(primary: string, fallback = 'GEN'): string {
  const norm = normalizeText(primary.trim());
  if (norm.length >= 3) return norm.slice(0, 3);
  if (norm.length > 0)  return norm.padEnd(3, 'X');
  const fb = normalizeText(fallback.trim());
  if (fb.length >= 3)   return fb.slice(0, 3);
  return fb.padEnd(3, 'X');
}

/**
 * Extrae el número secuencial al final de un código.
 * Retorna 0 si no hay número parseable.
 *
 * Ejemplos:
 *   "CEM-0001" → 1
 *   "MAM-012"  → 12
 *   "APU-0"    → 0
 *   "SIN-NUM"  → 0
 */
function extractSeq(code: string): number {
  const m = code.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Calcula el siguiente número de secuencia para un prefijo dado,
 * examinando los códigos existentes que empiecen con `prefix + separator`.
 *
 * Retorna 1 si no hay ningún código previo con ese prefijo.
 *
 * @param prefix        Prefijo de 3 chars (e.g. "CEM", "MAM")
 * @param existingCodes Lista de códigos ya registrados en el catálogo
 * @param separator     Separador entre prefijo y secuencia (default "-")
 */
export function nextSequence(
  prefix: string,
  existingCodes: string[],
  separator = '-',
): number {
  const pattern = prefix + separator;
  const usedNums = existingCodes
    .filter(c => typeof c === 'string' && c.startsWith(pattern))
    .map(extractSeq)
    .filter(n => n > 0);
  return usedNums.length > 0 ? Math.max(...usedNums) + 1 : 1;
}

// ─── Sugerencias específicas por tipo ─────────────────────────────────────────

/**
 * Sugiere un código para un Material Maestro.
 *
 * Formato: {CAT_3}-{SEQ:04d}
 * Ejemplo:
 *   category = "Cemento",  existingCodes = ["CEM-0001"] → "CEM-0002"
 *   category = "",         existingCodes = []           → "MAT-0001"
 *   category = "Hierros",  existingCodes = []           → "HIE-0001"
 *
 * @param category      Categoría del material (puede estar vacía)
 * @param existingCodes Códigos de materiales ya registrados en el catálogo
 */
export function suggestMaterialCode(
  category: string,
  existingCodes: string[],
): string {
  const prefix = categoryPrefix(category, 'MAT');
  const seq    = nextSequence(prefix, existingCodes);
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/**
 * Sugiere un código para una Tarea APU Maestra.
 *
 * Formato: {CAT_3}-{SEQ:03d}
 * Ejemplo:
 *   category = "Mampostería", existingCodes = ["MAM-001", "MAM-002"] → "MAM-003"
 *   category = "",            existingCodes = []                     → "APU-001"
 *   category = "Hormigón",    existingCodes = []                     → "HOR-001"
 *
 * @param category      Categoría/rubro de la tarea (puede estar vacía)
 * @param existingCodes Códigos de tareas APU ya registradas en el catálogo
 */
export function suggestTaskCode(
  category: string,
  existingCodes: string[],
): string {
  const prefix = categoryPrefix(category, 'APU');
  const seq    = nextSequence(prefix, existingCodes);
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}
