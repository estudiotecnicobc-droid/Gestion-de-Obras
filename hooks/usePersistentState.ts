import { useState, useEffect, useRef } from 'react';

export function usePersistentState<T>(key: string, initialValue: T) {
  // Guard para saltar la escritura del mount inicial (el valor ya viene de localStorage)
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
    // En el primer render el estado ya fue leído de localStorage: no reescribir.
    // Esto también evita la doble escritura de React StrictMode en desarrollo.
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
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
