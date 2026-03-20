import React, { useState, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Save, X, ArrowLeft,
  LayoutGrid, Search, AlertTriangle, CheckCircle,
  ArrowUp, ArrowDown, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useERP } from '../context/ERPContext';
import { useBudgetTemplates } from '../hooks/useBudgetTemplates';
import { useMasterTasks } from '../hooks/useMasterTasks';
import { BudgetTemplate, BudgetTemplateItem } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_TEMPLATE: Omit<BudgetTemplate, 'id' | 'organizationId' | 'isActive' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  category: '',
  items: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Panel principal
// ─────────────────────────────────────────────────────────────────────────────

export const BudgetTemplatesPanel: React.FC = () => {
  const { user } = useAuth();
  const orgId = user?.organizationId ?? '';
  const { rubros } = useERP();
  const { templates, loading: templatesLoading, error: templatesError, add, update, remove } = useBudgetTemplates(orgId);
  const { tasks: masterTasks } = useMasterTasks(orgId);

  // Mapa id→name para mostrar nombres de tareas en los items
  const masterTasksMap = useMemo(
    () => Object.fromEntries(masterTasks.map(t => [t.id, t])),
    [masterTasks],
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  type View = 'list' | 'edit';
  const [view, setView] = useState<View>('list');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [draft, setDraft] = useState<typeof EMPTY_TEMPLATE & { id?: string }>(EMPTY_TEMPLATE);
  const [selTask, setSelTask] = useState('');

  const isNew = !draft.id;

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const openNew = () => {
    setDraft({ ...EMPTY_TEMPLATE });
    setSelTask('');
    setView('edit');
  };

  const openEdit = (t: BudgetTemplate) => {
    setDraft({
      id: t.id,
      name: t.name,
      description: t.description ?? '',
      category: t.category ?? '',
      items: t.items.map(i => ({ ...i })),
    });
    setSelTask('');
    setView('edit');
  };

  const backToList = () => {
    setView('list');
    setDraft({ ...EMPTY_TEMPLATE });
  };

  // ── Item management ───────────────────────────────────────────────────────
  const addItem = () => {
    if (!selTask) return;
    setDraft(d => ({
      ...d,
      items: [
        ...d.items,
        { masterTaskId: selTask, quantity: 1, sortOrder: d.items.length },
      ],
    }));
    setSelTask('');
  };

  const removeItem = (masterTaskId: string) => {
    setDraft(d => ({
      ...d,
      items: d.items
        .filter(i => i.masterTaskId !== masterTaskId)
        .map((i, idx) => ({ ...i, sortOrder: idx })),
    }));
  };

  const updateItemQty = (masterTaskId: string, quantity: number) => {
    setDraft(d => ({
      ...d,
      items: d.items.map(i =>
        i.masterTaskId === masterTaskId ? { ...i, quantity: Math.max(0.01, quantity) } : i,
      ),
    }));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= draft.items.length) return;
    setDraft(d => {
      const items = [...d.items];
      [items[idx], items[next]] = [items[next], items[idx]];
      return { ...d, items: items.map((i, n) => ({ ...i, sortOrder: n })) };
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!draft.name.trim()) {
      showMsg('error', 'El nombre es obligatorio.');
      return;
    }
    const payload = {
      name: draft.name.trim(),
      description: draft.description,
      category: draft.category,
      items: draft.items,
    };
    setSaving(true);
    try {
      if (isNew) {
        await add(payload);
        showMsg('success', `Plantilla "${draft.name}" creada.`);
      } else {
        await update(draft.id!, payload);
        showMsg('success', `Plantilla "${draft.name}" actualizada.`);
      }
      backToList();
    } catch (e: any) {
      showMsg('error', e.message ?? 'Error al guardar la plantilla.');
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter(
      t => !q || t.name.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q),
    );
  }, [templates, search]);

  // Tasks no usadas en el draft (para el selector)
  const usedTaskIds = new Set(draft.items.map(i => i.masterTaskId));
  const availableTasks = masterTasks.filter(t => !usedTaskIds.has(t.id));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in">

      {/* Toast */}
      {message && (
        <div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* ── VISTA LISTA ─────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <LayoutGrid size={18} className="text-violet-600" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Plantillas de Presupuesto</h3>
                <p className="text-xs text-slate-500">{templates.length} plantilla{templates.length !== 1 ? 's' : ''} · Org: {orgId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 w-40"
                />
              </div>
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
              >
                <Plus size={14} /> Nueva Plantilla
              </button>
            </div>
          </div>

          {/* Loading / Error de Supabase */}
          {templatesLoading && (
            <div className="mx-4 mt-4 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 animate-pulse">
              Cargando plantillas…
            </div>
          )}
          {templatesError && !templatesLoading && (
            <div className="mx-4 mt-4 flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertTriangle size={14} className="flex-shrink-0" />
              {templatesError}
            </div>
          )}

          {/* Empty state / list */}
          {!templatesLoading && (filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <LayoutGrid size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-sm">
                {templates.length === 0 ? 'No hay plantillas todavía.' : 'Ninguna plantilla coincide con la búsqueda.'}
              </p>
              {templates.length === 0 && (
                <button onClick={openNew} className="mt-3 text-violet-600 text-xs font-bold hover:underline">
                  Crear primera plantilla →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-violet-50/30 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{t.items.length} tarea{t.items.length !== 1 ? 's' : ''}</span>
                      {t.category && (
                        <span className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded text-[10px] font-medium">{t.category}</span>
                      )}
                      {t.description && (
                        <span className="text-xs text-slate-400 truncate max-w-[200px]">{t.description}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    <button
                      onClick={() => openEdit(t)}
                      className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={async () => { if (confirm(`¿Eliminar plantilla "${t.name}"?`)) { try { await remove(t.id); showMsg('success', 'Plantilla eliminada.'); } catch (e: any) { showMsg('error', e.message ?? 'Error al eliminar.'); } } }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── VISTA EDICIÓN ───────────────────────────────────────────────── */}
      {view === 'edit' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <button onClick={backToList} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft size={16} />
              </button>
              <h3 className="font-bold text-slate-800 text-sm">
                {isNew ? 'Nueva Plantilla' : `Editar: ${draft.name || '…'}`}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={backToList} className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={14} /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">

            {/* Campos básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  value={draft.name}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="Ej: Vivienda Unifamiliar Completa"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoría / Etiqueta</label>
                <div className="relative">
                  <select
                    value={draft.category}
                    onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 appearance-none"
                  >
                    <option value="">— Sin categoría —</option>
                    {rubros.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
                <input
                  value={draft.description}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="Descripción opcional de la plantilla"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            {/* Agregar tarea */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Agregar tarea maestra</label>
              <div className="flex gap-2">
                <select
                  value={selTask}
                  onChange={e => setSelTask(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">— Seleccioná una tarea —</option>
                  {availableTasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.category ? `(${t.category})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addItem}
                  disabled={!selTask}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>
              {masterTasks.length === 0 && (
                <p className="text-xs text-amber-600 mt-1.5">
                  No hay tareas en la Base Maestra. Creá tareas desde la pestaña "APU Maestro" primero.
                </p>
              )}
            </div>

            {/* Lista de items */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">
                Tareas en la plantilla ({draft.items.length})
              </p>
              {draft.items.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs">
                  Agregá tareas maestras usando el selector de arriba.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {draft.items.map((item, idx) => {
                    const masterTask = masterTasksMap[item.masterTaskId];
                    return (
                      <div
                        key={item.masterTaskId}
                        className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                      >
                        {/* Orden */}
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button
                            onClick={() => moveItem(idx, -1)}
                            disabled={idx === 0}
                            className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => moveItem(idx, 1)}
                            disabled={idx === draft.items.length - 1}
                            className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            {masterTask?.name ?? <span className="text-red-400 italic">Tarea no encontrada</span>}
                          </p>
                          {masterTask?.category && (
                            <p className="text-[10px] text-slate-400">{masterTask.category}</p>
                          )}
                        </div>

                        {/* Cantidad */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <label className="text-[10px] text-slate-400">Cant.</label>
                          <input
                            type="number"
                            min="0.01"
                            step="1"
                            value={item.quantity ?? 1}
                            onChange={e => updateItemQty(item.masterTaskId, parseFloat(e.target.value) || 1)}
                            className="w-16 px-1.5 py-1 text-xs border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <span className="text-[10px] text-slate-400">{masterTask?.unit ?? ''}</span>
                        </div>

                        {/* Eliminar */}
                        <button
                          onClick={() => removeItem(item.masterTaskId)}
                          className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
