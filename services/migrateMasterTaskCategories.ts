import { MasterTask } from '../types';

/** Strips accents and lowercases for locale-agnostic comparison. */
function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Returns the canonical rubro that best matches a legacy category string,
 * or null if no match exceeds the threshold.
 *
 * Matching strategy (descending priority):
 *  1. Exact match → already canonical, skip.
 *  2. Substring: normalized category is contained in the normalized rubro.
 *  3. Substring reverse: normalized rubro keyword (without number prefix) is
 *     contained in the normalized category.
 *  4. Token overlap: shared meaningful tokens (length > 3) between category
 *     and rubro.
 */
function findBestMatch(category: string, rubros: string[]): string | null {
  if (rubros.includes(category)) return category;

  const normCat = normalize(category);
  if (!normCat) return null;

  let bestRubro: string | null = null;
  let bestScore = 0;

  for (const rubro of rubros) {
    const normRubro = normalize(rubro);
    // Strip leading "NN " number prefix to get the keyword part.
    const rubroKeyword = normRubro.replace(/^\d+\s+/, '');
    let score = 0;

    if (normRubro.includes(normCat)) {
      // e.g. "Mampostería" in "06 mamposteria, y otros cerramientos"
      score = 3;
    } else if (normCat.includes(rubroKeyword)) {
      // e.g. category is a superset of the rubro keyword
      score = 2;
    } else {
      // Token-level overlap as fallback
      const catTokens = normCat.split(/[\s,]+/).filter(t => t.length > 3);
      const rubroTokens = normRubro.split(/[\s,]+/).filter(t => t.length > 3);
      for (const ct of catTokens) {
        if (rubroTokens.some(rt => rt.includes(ct) || ct.includes(rt))) score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRubro = rubro;
    }
  }

  return bestScore > 0 ? bestRubro : null;
}

/**
 * Normalizes legacy free-text MasterTask categories to canonical rubros.
 *
 * - Idempotent: tasks whose category is already a canonical rubro are unchanged.
 * - Pure: no side effects, returns a new array only when at least one task changes.
 */
export function migrateMasterTaskCategories(
  tasks: MasterTask[],
  rubros: string[],
): MasterTask[] {
  return tasks.map(task => {
    const matched = findBestMatch(task.category, rubros);
    if (!matched || matched === task.category) return task;
    return { ...task, category: matched };
  });
}
