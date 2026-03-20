import { useState, useEffect, useCallback } from 'react';
import { MasterMaterial } from '../types';
import { masterMaterialsService } from '../services/masterMaterialsService';

interface UseMasterMaterialsReturn {
  items: MasterMaterial[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  add: (m: Omit<MasterMaterial, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'isActive'>) => Promise<void>;
  update: (id: string, updates: Partial<MasterMaterial>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useMasterMaterials(organizationId: string): UseMasterMaterialsReturn {
  const [items, setItems] = useState<MasterMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await masterMaterialsService.list(organizationId);
      setItems(data);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar materiales maestros');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const add = async (
    m: Omit<MasterMaterial, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'isActive'>
  ): Promise<void> => {
    const created = await masterMaterialsService.create({ ...m, organizationId });
    setItems(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const update = async (id: string, updates: Partial<MasterMaterial>): Promise<void> => {
    const updated = await masterMaterialsService.update(id, updates);
    setItems(prev => prev.map(i => i.id === id ? updated : i));
  };

  const remove = async (id: string): Promise<void> => {
    await masterMaterialsService.deactivate(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return { items, loading, error, reload: load, add, update, remove };
}
