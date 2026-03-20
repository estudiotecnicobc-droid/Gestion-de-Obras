/**
 * components/BudgetBusinessPanel.tsx
 *
 * Panel del Cuadro Empresario / Coeficiente de Pase K.
 * Se renderiza debajo del footer de totales en BudgetEditor.
 *
 * Responsabilidades:
 *  - Leer el resumen K via useBudgetSummary (sin duplicar cálculos).
 *  - Editar los 4 porcentajes via useBudgetKStore.
 *  - Convertir entre UI (% entero/decimal, ej: 8) y store (decimal, ej: 0.08).
 *
 * NO conecta a Supabase. NO toca ERPContext.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp, Info, Save, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { BusinessConfig, PricingConfig } from '../types';
import { useBudgetSummary } from '../hooks/useBudgetSummary';
import { useBudgetKStore } from '../store/useBudgetKStore';

// ─── Helpers de conversión y formato ──────────────────────────────────────────

/** decimal 0.08 → display 8.00 */
const toDisplayPct = (decimal: number): string =>
  (decimal * 100).toFixed(2);

/** string "8.5" del input → decimal 0.085 para el store */
const fromInputPct = (raw: string): number => {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? Math.max(0, n) / 100 : 0;
};

/** Formato monetario: 153065.50 → "$153.065,50" usando locale del browser */
const fmtMoney = (n: number): string =>
  '$\u00a0' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formato K con 4 decimales */
const fmtK = (k: number): string => k.toFixed(4);

// ─── Sub-componente: input de porcentaje ──────────────────────────────────────

interface PctInputProps {
  label: string;
  value: number;          // decimal (0.08)
  onChange: (v: number) => void;
  hint?: string;
}

const PctInput: React.FC<PctInputProps> = ({ label, value, onChange, hint }) => (
  <div className="space-y-1">
    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide">
      {label}
    </label>
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min="0"
        step="0.01"
        value={toDisplayPct(value)}
        onChange={e => onChange(fromInputPct(e.target.value))}
        className="w-24 px-2 py-1.5 text-right font-mono text-sm border border-slate-300
                   rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   outline-none bg-white shadow-sm"
      />
      <span className="text-sm text-slate-500 font-medium">%</span>
    </div>
    {hint && <p className="text-[10px] text-slate-400 italic">{hint}</p>}
  </div>
);

// ─── Sub-componente: fila del cuadro de resultados ────────────────────────────

interface SummaryRowProps {
  label: string;
  amount: number;
  pct?: number;           // decimal, si corresponde mostrar "(8%)"
  highlight?: boolean;    // negrita + separador superior
  accent?: 'blue' | 'green' | 'amber';
}

const SummaryRow: React.FC<SummaryRowProps> = ({ label, amount, pct, highlight, accent }) => {
  const accentColor = accent === 'green'
    ? 'text-emerald-700 font-black'
    : accent === 'blue'
    ? 'text-blue-700 font-bold'
    : accent === 'amber'
    ? 'text-amber-700 font-bold'
    : 'text-slate-700';

  return (
    <div className={`flex justify-between items-baseline py-1.5 ${highlight ? 'border-t-2 border-slate-300 mt-1 pt-2.5' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>
        {label}
        {pct !== undefined && (
          <span className="ml-1.5 text-[10px] font-mono text-slate-400">
            ({(pct * 100).toFixed(1)}%)
          </span>
        )}
      </span>
      <span className={`font-mono text-sm tabular-nums ${accentColor}`}>
        {fmtMoney(amount)}
      </span>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

interface BudgetBusinessPanelProps {
  projectId: string;
  directCost: number;
  /** Config persistida en DB. Prioridad máxima sobre localStorage y legacy. */
  businessConfigFromDB?: BusinessConfig;
  /** Fallback legacy si no hay config en DB ni en localStorage. */
  legacyPricing?: PricingConfig;
  isOpen: boolean;
  onToggle: () => void;
  /** Llamado al guardar. Recibe la config actual del store para persistir en DB. */
  onSave: (config: BusinessConfig) => Promise<void>;
}

export const BudgetBusinessPanel: React.FC<BudgetBusinessPanelProps> = ({
  projectId,
  directCost,
  businessConfigFromDB,
  legacyPricing,
  isOpen,
  onToggle,
  onSave,
}) => {
  const [saveState, setSaveState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Inicialización con prioridad DB > legacy > localStorage/DEFAULT ──────────
  // Prioridad 1: si viene config desde DB, siempre sobreescribe (setConfig sin guard).
  // Prioridad 2: si no hay DB config, initFromPricing usa legacy o DEFAULT
  //             y tiene guard interno para no sobreescribir ediciones locales.
  const setConfig       = useBudgetKStore(s => s.setConfig);
  const initFromPricing = useBudgetKStore(s => s.initFromPricing);

  useEffect(() => {
    if (businessConfigFromDB) {
      // DB tiene prioridad — sobreescribe localStorage sin condición.
      setConfig(projectId, businessConfigFromDB);
    } else {
      // Sin config en DB: usar legacy (PricingConfig) o DEFAULT.
      // initFromPricing tiene guard: no sobreescribe si ya hay config en store.
      initFromPricing(projectId, legacyPricing);
    }
  }, [projectId, businessConfigFromDB]); // eslint-disable-line react-hooks/exhaustive-deps
  // Intencional: re-inicializar solo cuando cambia el proyecto o llega nueva config de DB.

  // Resumen K — useBudgetSummary ya no necesita options de init (ya manejado arriba)
  const summary = useBudgetSummary(projectId, directCost);

  // ── Acciones de edición (referencias estables de Zustand) ─────────────────
  const updateGgdPct    = useBudgetKStore(s => s.updateGgdPct);
  const updateGgiPct    = useBudgetKStore(s => s.updateGgiPct);
  const updateProfitPct = useBudgetKStore(s => s.updateProfitPct);
  const updateTaxPct    = useBudgetKStore(s => s.updateTaxPct);

  // Callbacks memoizados para evitar re-render de PctInput
  const handleGgd    = useCallback((v: number) => updateGgdPct(projectId, v),    [projectId, updateGgdPct]);
  const handleGgi    = useCallback((v: number) => updateGgiPct(projectId, v),    [projectId, updateGgiPct]);
  const handleProfit = useCallback((v: number) => updateProfitPct(projectId, v), [projectId, updateProfitPct]);
  const handleTax    = useCallback((v: number) => updateTaxPct(projectId, v),    [projectId, updateTaxPct]);

  const { businessConfig: cfg } = summary;

  // Detectar cambios sin guardar respecto a la config en DB.
  const isDirty = useMemo(() => {
    if (!businessConfigFromDB) return true; // nunca guardado = siempre dirty
    return (
      cfg.ggdPct    !== businessConfigFromDB.ggdPct    ||
      cfg.ggiPct    !== businessConfigFromDB.ggiPct    ||
      cfg.profitPct !== businessConfigFromDB.profitPct ||
      cfg.taxPct    !== businessConfigFromDB.taxPct
    );
  }, [cfg, businessConfigFromDB]);

  // Guardar en DB: async, propaga error real.
  const handleSave = useCallback(async () => {
    if (saveState === 'loading') return;
    setSaveState('loading');
    setSaveError(null);
    try {
      await onSave(cfg);
      setSaveState('success');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }, [cfg, onSave, saveState]);

  // Autosave cada 5 minutos si hay cambios sin guardar.
  // Usamos refs para leer los valores más recientes sin reiniciar el interval.
  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  useEffect(() => {
    const FIVE_MIN = 5 * 60 * 1000;
    const timer = setInterval(() => {
      if (isDirtyRef.current) {
        handleSaveRef.current();
      }
    }, FIVE_MIN);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="border-t-2 border-blue-800 bg-slate-800">

      {/* ── Barra de título / toggle ── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-3
                   hover:bg-slate-700 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <TrendingUp size={16} className="text-blue-400" />
          <span className="text-sm font-bold text-slate-200 uppercase tracking-wide">
            Cuadro Empresario
          </span>
          {/* K badge — siempre visible para referencia rápida */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                           bg-blue-600 text-white text-xs font-black font-mono">
            K = {fmtK(summary.kFactor)}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Venta: {fmtMoney(summary.finalSalePrice)}
          </span>
        </div>
        {isOpen
          ? <ChevronUp size={16} className="text-slate-400" />
          : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {/* ── Panel expandido ── */}
      {isOpen && (
        <div className="bg-slate-50 border-t border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-200">

            {/* ── Columna izquierda: parámetros editables ── */}
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                  Parámetros
                </h3>
                <span
                  title="Los porcentajes se aplican en cascada sobre el Costo Directo."
                  className="text-slate-400 cursor-help"
                >
                  <Info size={13} />
                </span>
              </div>

              <PctInput
                label="GGD — Gastos Generales Directos"
                value={cfg.ggdPct}
                onChange={handleGgd}
                hint="Plantel de obra, equipo en sitio, combustibles."
              />
              <PctInput
                label="GGI — Gastos Generales Indirectos"
                value={cfg.ggiPct}
                onChange={handleGgi}
                hint="Administración, seguros, gastos financieros."
              />
              <PctInput
                label="Beneficio / Utilidad"
                value={cfg.profitPct}
                onChange={handleProfit}
              />
              <PctInput
                label="Impuestos (IVA / IIBB)"
                value={cfg.taxPct}
                onChange={handleTax}
                hint="Aplica sobre el precio de venta sin impuestos."
              />

              {/* Persistencia — estado y botón guardar */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <p className="text-[10px] text-slate-400 italic">
                  {businessConfigFromDB
                    ? isDirty
                      ? 'Hay cambios sin guardar.'
                      : 'Config guardada en base de datos.'
                    : 'Config aún no guardada en base de datos (usando valores locales).'}
                </p>
                {saveState === 'error' && saveError && (
                  <p className="text-[10px] text-red-600 flex items-center gap-1">
                    <AlertCircle size={11} /> {saveError}
                  </p>
                )}
                <button
                  onClick={handleSave}
                  disabled={saveState === 'loading' || (!isDirty && saveState !== 'error')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold
                             bg-blue-600 hover:bg-blue-700 text-white transition-colors w-full justify-center
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveState === 'loading' && <><Loader2 size={13} className="animate-spin" /> Guardando...</>}
                  {saveState === 'success' && <><CheckCircle size={13} /> Guardado</>}
                  {saveState === 'error'   && <><AlertCircle size={13} /> Reintentar</>}
                  {saveState === 'idle'    && <><Save size={13} /> {isDirty ? 'Guardar cambios' : 'Guardar en proyecto'}</>}
                </button>
              </div>
            </div>

            {/* ── Columna derecha: resultados en cascada ── */}
            <div className="p-6">
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">
                Resumen
              </h3>

              <div className="space-y-0.5">
                <SummaryRow
                  label="Costo Directo (CD)"
                  amount={summary.directCost}
                  accent="blue"
                />
                <SummaryRow
                  label="+ GGD"
                  amount={summary.ggdAmount}
                  pct={cfg.ggdPct}
                />
                <SummaryRow
                  label="+ GGI"
                  amount={summary.ggiAmount}
                  pct={cfg.ggiPct}
                />
                <SummaryRow
                  label="Subtotal (CD + GGD + GGI)"
                  amount={summary.subtotalBeforeProfit}
                  highlight
                />
                <SummaryRow
                  label="+ Beneficio"
                  amount={summary.profitAmount}
                  pct={cfg.profitPct}
                  accent="amber"
                />
                <SummaryRow
                  label="Subtotal antes de impuestos"
                  amount={summary.subtotalBeforeTax}
                  highlight
                />
                <SummaryRow
                  label="+ Impuestos"
                  amount={summary.taxAmount}
                  pct={cfg.taxPct}
                />

                {/* Precio final — destacado */}
                <div className="mt-3 pt-3 border-t-2 border-emerald-500">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-wide">
                      Precio de Venta
                    </span>
                    <span className="font-mono text-xl font-black text-emerald-700 tabular-nums">
                      {fmtMoney(summary.finalSalePrice)}
                    </span>
                  </div>
                </div>

                {/* K factor */}
                <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200
                                flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                      Coeficiente de Pase K
                    </span>
                    <p className="text-[10px] text-blue-500 mt-0.5">
                      Precio Venta ÷ Costo Directo
                    </p>
                  </div>
                  <span className="font-mono text-2xl font-black text-blue-700">
                    {fmtK(summary.kFactor)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
