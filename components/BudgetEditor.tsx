
import React, { useState, useMemo, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { calculateUnitPrice } from '../services/calculationService';
import { 
  Trash2, Plus, Search, Settings, Save, CheckSquare, Square, 
  ArrowRight, Printer, Calculator, ChevronDown, ChevronRight,
  Info, RefreshCcw, DollarSign, Clock, X, Package, Hammer, Edit3, AlertCircle, PenTool
} from 'lucide-react';
import { Task, ProjectTemplate } from '../types';
import { PROJECT_TEMPLATES } from '../constants';
import { APUBuilder } from './APUBuilder';

export const BudgetEditor: React.FC = () => {
  const { 
    project, tasks, rubros,
    addBudgetItem, removeBudgetItem, updateBudgetItem, updateTask,
    yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, 
    taskCrewYieldsIndex, crewsMap, laborCategoriesMap,
    loadTemplate
  } = useERP();

  // --- UI STATES ---
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(2); 
  const [selectedRubros, setSelectedRubros] = useState<Set<string>>(new Set(rubros));
  const [globalAdjustment, setGlobalAdjustment] = useState<number>(0); 
  const [expandedRubros, setExpandedRubros] = useState<Set<string>>(new Set(rubros)); 

  // --- CONFIG PANEL STATE (Quick Add/Edit Item) ---
  const [configPanel, setConfigPanel] = useState<{
      isOpen: boolean;
      mode: 'add' | 'edit';
      category: string; 
      itemId?: string; 
      selectedTaskId: string;
      quantity: number;
  }>({
      isOpen: false,
      mode: 'add',
      category: '',
      selectedTaskId: '',
      quantity: 1
  });

  // --- MASTER APU EDITOR STATE ---
  const [apuEditorTaskId, setApuEditorTaskId] = useState<string | null>(null);

  // --- CALCULATIONS & DATA PREP ---
  const budgetData = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    const categoryTotals: Record<string, { mat: number, lab: number, total: number }> = {};

    Array.from(selectedRubros).sort().forEach((r: string) => {
        grouped[r] = [];
        categoryTotals[r] = { mat: 0, lab: 0, total: 0 };
    });
    
    grouped['Otros'] = [];
    categoryTotals['Otros'] = { mat: 0, lab: 0, total: 0 };

    project.items.forEach(item => {
      const task = tasks.find(t => t.id === item.taskId);
      if (!task) return;

      const category = task.category && selectedRubros.has(task.category) ? task.category : 'Otros';
      
      const analysis = calculateUnitPrice(task, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, taskCrewYieldsIndex, crewsMap, laborCategoriesMap);
      
      const unitMatEq = analysis.materialCost + analysis.toolCost + analysis.fixedCost;
      const unitLab = analysis.laborCost;
      
      const totalMatEq = unitMatEq * item.quantity;
      const totalLab = unitLab * item.quantity;
      const totalItem = totalMatEq + totalLab;

      if (categoryTotals[category]) {
          categoryTotals[category].mat += totalMatEq;
          categoryTotals[category].lab += totalLab;
          categoryTotals[category].total += totalItem;
      }

      if (grouped[category]) {
          grouped[category].push({
              item,
              task,
              analysis,
              unitMatEq,
              unitLab,
              totalMatEq,
              totalLab,
              totalItem
          });
      }
    });

    return { grouped, categoryTotals };
  }, [project.items, tasks, selectedRubros, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, taskCrewYieldsIndex, crewsMap, laborCategoriesMap]);

  const grandTotals = useMemo(() => {
      let mat = 0;
      let lab = 0;
      Object.values(budgetData.categoryTotals).forEach((t: any) => {
          mat += t.mat;
          lab += t.lab;
      });
      const subtotal = mat + lab;
      const adjustmentAmount = subtotal * (globalAdjustment / 100);
      const finalTotal = subtotal + adjustmentAmount;

      return { mat, lab, subtotal, adjustmentAmount, finalTotal };
  }, [budgetData, globalAdjustment]);


  // --- HANDLERS ---

  const toggleRubroSelection = (rubro: string) => {
      const newSet = new Set(selectedRubros);
      if (newSet.has(rubro)) newSet.delete(rubro);
      else newSet.add(rubro);
      setSelectedRubros(newSet);
  };

  const toggleRubroExpansion = (rubro: string) => {
      const newSet = new Set(expandedRubros);
      if (newSet.has(rubro)) newSet.delete(rubro);
      else newSet.add(rubro);
      setExpandedRubros(newSet);
  };

  const selectAllRubros = () => setSelectedRubros(new Set(rubros));
  const clearRubros = () => setSelectedRubros(new Set());

  // Quick Add Handler
  const handleQuickAddTask = (category: string) => {
      const firstTask = tasks.find(t => t.category === category);
      setConfigPanel({
          isOpen: true,
          mode: 'add',
          category: category,
          selectedTaskId: firstTask ? firstTask.id : '',
          quantity: 1
      });
  };

  // Item Edit Handler (Quantity/Task Swap)
  const handleEditItem = (item: any) => {
      const task = tasks.find(t => t.id === item.taskId);
      setConfigPanel({
          isOpen: true,
          mode: 'edit',
          category: task?.category || 'Otros',
          itemId: item.id,
          selectedTaskId: item.taskId,
          quantity: item.quantity
      });
  };

  const handleSavePanel = () => {
      if (!configPanel.selectedTaskId) return;

      if (configPanel.mode === 'add') {
          addBudgetItem({
              id: crypto.randomUUID(),
              taskId: configPanel.selectedTaskId,
              quantity: configPanel.quantity
          });
      } else if (configPanel.mode === 'edit' && configPanel.itemId) {
          updateBudgetItem(configPanel.itemId, {
              taskId: configPanel.selectedTaskId,
              quantity: configPanel.quantity
          });
      }
      setConfigPanel({ ...configPanel, isOpen: false });
  };

  // Render logic
  return (
    <div className="flex h-full gap-6 font-sans relative">
      
      {/* LEFT SIDEBAR: STAGES SELECTION */}
      <div className="w-72 flex-shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm h-full">
          <div className="p-4 bg-slate-900 text-white">
              <h3 className="font-bold text-lg">Etapas de Obra</h3>
              <p className="text-xs text-slate-400 mt-1">Seleccione los rubros activos</p>
          </div>
          
          <div className="p-2 border-b border-slate-100 flex justify-between">
              <button onClick={selectAllRubros} className="text-[10px] text-blue-600 font-bold hover:underline px-2">✓ Seleccionar todo</button>
              <button onClick={clearRubros} className="text-[10px] text-slate-400 hover:text-slate-600 px-2">Limpiar</button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {rubros.map((rubro, idx) => {
                  const isSelected = selectedRubros.has(rubro);
                  const hasItems = budgetData.grouped[rubro]?.length > 0;
                  
                  return (
                      <div 
                        key={rubro} 
                        onClick={() => toggleRubroSelection(rubro)}
                        className={`
                            group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border
                            ${isSelected 
                                ? 'bg-slate-700 text-white border-slate-600 shadow-md' 
                                : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'
                            }
                        `}
                      >
                          <div className={`
                              w-6 h-6 flex items-center justify-center rounded font-bold text-xs
                              ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500'}
                          `}>
                              {idx + 1}
                          </div>
                          <span className="text-xs font-bold uppercase truncate flex-1">{rubro}</span>
                          {hasItems && <div className="w-2 h-2 rounded-full bg-emerald-400"></div>}
                      </div>
                  );
              })}
          </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
          
          {/* HEADER & STEPPER */}
          <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-end mb-6">
                  <div>
                      <h1 className="text-2xl font-black text-slate-800 tracking-tight">Cómputo y Presupuesto Profesional</h1>
                      <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                          <Clock size={14} /> Última actualización: {new Date().toLocaleDateString()}
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
                          <Printer size={16} /> Imprimir
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                          <Save size={16} /> Guardar Cambios
                      </button>
                  </div>
              </div>
          </div>

          {/* TABLE CONTENT */}
          <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
              <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                      <thead>
                          <tr className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200">
                              <th className="p-3 w-1/3">Descripción del Ítem</th>
                              <th className="p-3 w-16 text-center">Unidad</th>
                              <th className="p-3 w-24 text-center">Cantidad</th>
                              
                              <th className="p-3 w-28 text-right bg-blue-50/50 border-l border-slate-200">Material<br/>x Unidad</th>
                              <th className="p-3 w-28 text-right bg-blue-50/50">Material<br/>Subtotal</th>
                              
                              <th className="p-3 w-28 text-right bg-orange-50/50 border-l border-slate-200">M.Obra<br/>x Unidad</th>
                              <th className="p-3 w-28 text-right bg-orange-50/50">M.Obra<br/>Subtotal</th>
                              
                              <th className="p-3 w-32 text-right bg-slate-200/50 border-l border-slate-200">Subtotal</th>
                              <th className="p-3 w-20 text-center"></th>
                          </tr>
                      </thead>
                      <tbody>
                          {Array.from(selectedRubros).map((rubro: string) => {
                              const items = budgetData.grouped[rubro] || [];
                              const isExpanded = expandedRubros.has(rubro);
                              const totals = budgetData.categoryTotals[rubro];

                              return (
                                  <React.Fragment key={rubro}>
                                      {/* RUBRO HEADER */}
                                      <tr className="bg-slate-800 text-white cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => toggleRubroExpansion(rubro)}>
                                          <td colSpan={1} className="p-2 pl-4 font-bold text-sm flex items-center gap-2 uppercase tracking-wide">
                                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                              {rubro}
                                          </td>
                                          <td colSpan={6}></td>
                                          <td className="p-2 text-right font-mono font-bold text-sm">
                                              ${totals.total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                          </td>
                                          <td></td>
                                      </tr>

                                      {/* RUBRO ITEMS */}
                                      {isExpanded && (
                                          <>
                                              {items.length === 0 ? (
                                                  <tr>
                                                      <td colSpan={9} className="p-4 text-center bg-slate-50 border-b border-slate-200">
                                                          <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                                                              <span className="text-xs italic">No hay ítems en esta etapa.</span>
                                                              <button onClick={() => handleQuickAddTask(rubro)} className="text-blue-600 font-bold text-xs hover:underline flex items-center gap-1">
                                                                  <Plus size={12} /> Agregar Tarea Estándar
                                                              </button>
                                                          </div>
                                                      </td>
                                                  </tr>
                                              ) : (
                                                  <>
                                                    {items.map((row) => (
                                                        <tr key={row.item.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
                                                            {/* Description */}
                                                            <td className="p-2 pl-8">
                                                                <div className="font-medium text-slate-700 text-xs">{row.task.name}</div>
                                                                <div className="text-[9px] text-slate-400">{row.task.code}</div>
                                                            </td>
                                                            
                                                            {/* Unit */}
                                                            <td className="p-2 text-center text-xs text-slate-500 bg-slate-50/50">{row.task.unit}</td>
                                                            
                                                            {/* Quantity Input */}
                                                            <td className="p-2">
                                                                <input 
                                                                    type="number"
                                                                    className="w-full text-center p-1 border border-slate-300 rounded text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                                    value={row.item.quantity}
                                                                    onChange={(e) => updateBudgetItem(row.item.id, { quantity: parseFloat(e.target.value) })}
                                                                />
                                                            </td>

                                                            {/* Material Columns */}
                                                            <td className="p-2 text-right text-xs text-slate-500 border-l border-slate-100 font-mono">
                                                                ${row.unitMatEq.toFixed(2)}
                                                            </td>
                                                            <td className="p-2 text-right text-xs font-bold text-slate-600 bg-blue-50/20 font-mono">
                                                                ${row.totalMatEq.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                            </td>

                                                            {/* Labor Columns */}
                                                            <td className="p-2 text-right text-xs text-slate-500 border-l border-slate-100 font-mono">
                                                                ${row.unitLab.toFixed(2)}
                                                            </td>
                                                            <td className="p-2 text-right text-xs font-bold text-slate-600 bg-orange-50/20 font-mono">
                                                                ${row.totalLab.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                            </td>

                                                            {/* Total & Action */}
                                                            <td className="p-2 text-right text-xs font-bold text-slate-800 bg-slate-100/50 border-l border-slate-200 font-mono">
                                                                ${row.totalItem.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <div className="flex justify-center gap-1">
                                                                    <button
                                                                        onClick={() => handleEditItem(row.item)}
                                                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                        title="Cambiar Cantidad / Tarea"
                                                                    >
                                                                        <Settings size={14} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setApuEditorTaskId(row.task.id)}
                                                                        className="p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                                                        title="Editar APU Maestro"
                                                                    >
                                                                        <PenTool size={14} />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => removeBudgetItem(row.item.id)}
                                                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                        title="Eliminar"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* Row to add item at end of list */}
                                                    <tr>
                                                        <td colSpan={9} className="p-1 bg-slate-50/50 border-b border-slate-100">
                                                            <button onClick={() => handleQuickAddTask(rubro)} className="w-full text-center text-[10px] text-blue-500 font-bold hover:bg-blue-50 py-1 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                                + Agregar Tarea
                                                            </button>
                                                        </td>
                                                    </tr>
                                                  </>
                                              )}
                                          </>
                                      )}
                                  </React.Fragment>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* FOOTER TOTALS */}
          <div className="bg-slate-900 text-white p-6 border-t-4 border-blue-600 shadow-2xl z-10">
              <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                  {/* ... Adjustments Summary ... */}
                  <div className="flex gap-8 text-right">
                      <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Materiales + Eq</div>
                          <div className="text-lg font-mono font-medium text-blue-300">
                              ${grandTotals.mat.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </div>
                      </div>
                      <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Mano de Obra</div>
                          <div className="text-lg font-mono font-medium text-orange-300">
                              ${grandTotals.lab.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </div>
                      </div>
                      <div>
                          <div className="text-xs font-bold text-slate-300 uppercase mb-1">TOTAL GENERAL</div>
                          <div className="text-4xl font-black text-white font-mono tracking-tight leading-none">
                              ${grandTotals.finalTotal.toLocaleString(undefined, {maximumFractionDigits: 2})}
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* CONFIGURATION SIDE PANEL (OVERLAY) */}
          {configPanel.isOpen && (
              <div className="absolute inset-0 z-50 flex justify-end">
                  <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setConfigPanel({ ...configPanel, isOpen: false })}></div>
                  <div className="w-[450px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 z-50">
                      
                      {/* Panel Header */}
                      <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                          <div>
                              <h3 className="font-bold text-lg text-slate-800">
                                  {configPanel.mode === 'add' ? 'Agregar Nueva Tarea' : 'Modificar Ítem'}
                              </h3>
                              <p className="text-xs text-slate-500 font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded w-fit mt-1">
                                  {configPanel.category}
                              </p>
                          </div>
                          <button onClick={() => setConfigPanel({ ...configPanel, isOpen: false })} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X size={20}/></button>
                      </div>

                      {/* Panel Body */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                          
                          {/* Task Selector */}
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Tarea de Base de Datos</label>
                              <select 
                                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm outline-none"
                                  value={configPanel.selectedTaskId}
                                  onChange={(e) => setConfigPanel({ ...configPanel, selectedTaskId: e.target.value })}
                              >
                                  <option value="">-- Seleccionar Tarea --</option>
                                  {tasks
                                    .filter(t => t.category === configPanel.category)
                                    .map(t => (
                                      <option key={t.id} value={t.id}>{t.name} ({t.unit})</option>
                                  ))}
                              </select>
                          </div>

                          {/* Quantity Input */}
                          <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Cantidad Presupuestada</label>
                              <div className="flex items-center gap-3">
                                  <input 
                                      type="number" 
                                      className="flex-1 p-3 border border-slate-300 rounded-lg text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                      value={configPanel.quantity}
                                      onChange={(e) => setConfigPanel({ ...configPanel, quantity: parseFloat(e.target.value) })}
                                      min="0"
                                  />
                                  <div className="w-16 h-12 flex items-center justify-center bg-slate-100 rounded-lg text-sm font-bold text-slate-500 border border-slate-200">
                                      {tasks.find(t => t.id === configPanel.selectedTaskId)?.unit || '-'}
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-5 border-t border-slate-200 bg-slate-50 flex gap-3">
                          <button 
                              onClick={() => setConfigPanel({ ...configPanel, isOpen: false })}
                              className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={handleSavePanel}
                              disabled={!configPanel.selectedTaskId || configPanel.quantity <= 0}
                              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              {configPanel.mode === 'add' ? 'Agregar Ítem' : 'Guardar Cambios'}
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* MASTER APU EDITOR MODAL */}
          {apuEditorTaskId && (
              <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                      <APUBuilder taskId={apuEditorTaskId} onClose={() => setApuEditorTaskId(null)} />
                  </div>
              </div>
          )}

      </div>
    </div>
  );
};
