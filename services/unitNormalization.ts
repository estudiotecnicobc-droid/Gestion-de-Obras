// ─── Normalización de unidades ────────────────────────────────────────────────
// Mapea alias comunes a la unidad canónica usada en la DB.
// Ejemplo: "hh" → "HS", "UD" → "UN", "kg" → "KG"

const UNIT_ALIASES: Record<string, string> = {
  // Horas
  'hh':  'HS',
  'HH':  'HS',
  'h':   'HS',
  'H':   'HS',
  'hr':  'HS',
  'HR':  'HS',
  'hs':  'HS',
  // Unidades
  'ud':  'UN',
  'UD':  'UN',
  'u':   'UN',
  'U':   'UN',
  'un':  'UN',
  'pza': 'UN',
  'PZA': 'UN',
  'pz':  'UN',
  'PZ':  'UN',
  // Masa
  'kg':  'KG',
  'Kg':  'KG',
  'KG':  'KG',
  'gr':  'GR',
  'GR':  'GR',
  'g':   'GR',
  't':   'TN',
  'tn':  'TN',
  'TN':  'TN',
  // Longitud
  'ml':  'ML',
  'ML':  'ML',
  'ml.': 'ML',
  'm':   'ML',
  // Área
  'm2':  'M2',
  'M2':  'M2',
  'm²':  'M2',
  'M²':  'M2',
  // Volumen
  'm3':  'M3',
  'M3':  'M3',
  'm³':  'M3',
  'M³':  'M3',
  'lts': 'LT',
  'lt':  'LT',
  'LT':  'LT',
  'l':   'LT',
  'L':   'LT',
};

/**
 * Devuelve la unidad canónica para una unidad raw.
 * Si no hay alias, devuelve el valor en mayúsculas.
 */
export function normalizeUnit(raw: string): string {
  const trimmed = raw.trim();
  return UNIT_ALIASES[trimmed] ?? UNIT_ALIASES[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
}

/** Devuelve true si dos unidades son equivalentes (tras normalización). */
export function unitsMatch(a: string, b: string): boolean {
  return normalizeUnit(a) === normalizeUnit(b);
}
