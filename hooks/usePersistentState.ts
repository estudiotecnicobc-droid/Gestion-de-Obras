
import { useState, useEffect, useRef } from 'react';

export function usePersistentState<T>(key: string, initialValue: T) {
  // Use a ref to track if it's the initial mount to prevent double-saving logic issues in StrictMode
  const isMounted = useRef(false);

  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved);
      }
      return initialValue;
    } catch (e) {
      console.warn(`[ERP Persistence] Error loading key "${key}":`, e);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      const serializedState = JSON.stringify(state);
      localStorage.setItem(key, serializedState);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.error(`[ERP Persistence] CRITICAL: Storage quota exceeded for key "${key}". Data may not be saved.`);
        alert("⚠️ Alerta de Sistema: El almacenamiento local del navegador está lleno. Le recomendamos descargar un Respaldo (Backup) inmediatamente desde el panel de Base de Datos.");
      } else {
        console.error(`[ERP Persistence] Error saving key "${key}":`, e);
      }
    }
  }, [key, state]);

  return [state, setState] as const;
}
