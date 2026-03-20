/**
 * utils/generateId.ts
 *
 * Wrapper seguro para generación de IDs únicos de frontend.
 * Usa globalThis.crypto.randomUUID() cuando está disponible
 * (HTTPS, Node ≥18, navegadores modernos con secure context).
 * Fallback para entornos HTTP de desarrollo o navegadores sin Crypto API:
 * timestamp base-36 + 8 chars hex aleatorios.
 *
 * Los IDs generados son suficientemente únicos para estado de UI y
 * para PKs temporales que luego son reemplazadas por UUIDs de la DB.
 */
export function generateId(): string {
  if (typeof globalThis?.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback UUID v4 para entornos HTTP (sin secure context).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
