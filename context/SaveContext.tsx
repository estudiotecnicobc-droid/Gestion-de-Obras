import React, { createContext, useContext, useState, useCallback } from 'react';

type SaveFn = () => Promise<void>;

interface SaveContextValue {
  saveHandler: SaveFn | null;
  registerSave: (fn: SaveFn) => void;
  unregisterSave: () => void;
}

const SaveContext = createContext<SaveContextValue>({
  saveHandler: null,
  registerSave: () => {},
  unregisterSave: () => {},
});

export const SaveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [saveHandler, setSaveHandlerState] = useState<SaveFn | null>(null);

  const registerSave = useCallback((fn: SaveFn) => {
    setSaveHandlerState(() => fn);
  }, []);

  const unregisterSave = useCallback(() => {
    setSaveHandlerState(null);
  }, []);

  return (
    <SaveContext.Provider value={{ saveHandler, registerSave, unregisterSave }}>
      {children}
    </SaveContext.Provider>
  );
};

export const useSave = () => useContext(SaveContext);
