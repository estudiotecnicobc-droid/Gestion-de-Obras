
import React, { useState, useMemo, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { calculateUnitPrice } from '../services/calculationService';
import { 
  Trash2, Plus, Search, Settings, Save, CheckSquare, Square, 
  ArrowRight, Printer, Calculator, ChevronDown, ChevronRight,
  Info, RefreshCcw, DollarSign, Clock, X, Package, Hammer, Edit3, AlertCircle, PenTool, Sparkles
} from 'lucide-react';
import { Task, ProjectTemplate } from '../types';
import { PROJECT_TEMPLATES } from '../constants';
import { APUBuilder } from './APUBuilder';

export const BudgetEditor: React.FC = () => {
  const { 
    project, tasks, rubros, rubroPresets,
    addBudgetItem, removeBudgetItem, updateBudgetItem, updateTask, addTask,
    addRubroPreset, removeRubroPreset,
    yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, 
    taskCrewYieldsIndex, crewsMap, laborCategoriesMap, taskLaborYieldsIndex,
    loadTemplate
  } = useERP();

  // --- UI STATES ---
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(2); 
  const [selectedRubros, setSelectedRubros] = useState<Set<string>>(new Set(rubros));
  const [globalAdjustment, setGlobalAdjustment] = useState<number>(0); 
  const [expandedRubros, setExpandedRubros] = useState<Set<string>>(new Set(rubros)); 
  const [managePresetsMode, setManagePresetsMode] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

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
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);

  // --- PRINT PREVIEW STATE ---
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printOptions, setPrintOptions] = useState({
      showUnitPrice: true,
      showQuantity: true,
      showMatSubtotal: true,
      showLabSubtotal: true,
      showTotal: true,
      showCategoryHeaders: true,
      showFooter: true,
      // NEW OPTIONS
      paperSize: 'a4', // 'a4', 'letter', 'legal'
      orientation: 'portrait', // 'portrait', 'landscape'
      showIcon: false,
      customText: '',
      showIncidence: false
  });
  const [printLogo, setPrintLogo] = useState<string | null>(null);

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
      
      const analysis = calculateUnitPrice(task, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, taskCrewYieldsIndex, crewsMap, laborCategoriesMap, 9, taskLaborYieldsIndex);
      
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

  const handleSelectPreset = (preset: Partial<Task>) => {
      // Check if task exists
      const existing = tasks.find(t => t.name === preset.name && t.category === configPanel.category);
      if (existing) {
          setConfigPanel(prev => ({ ...prev, selectedTaskId: existing.id }));
      } else {
          // Create new task
          const newId = `task_${crypto.randomUUID().substring(0,8)}`;
          const newTask: Task = {
              id: newId,
              organizationId: project.organizationId,
              name: preset.name || 'Nueva Tarea',
              unit: preset.unit || 'u',
              category: configPanel.category,
              laborCost: preset.laborCost || 0,
              dailyYield: preset.dailyYield || 1,
              description: preset.description || '',
              // ... defaults
          };
          addTask(newTask);
          setConfigPanel(prev => ({ ...prev, selectedTaskId: newId }));
      }
  };

  const handleAddPreset = () => {
      if (!newPresetName.trim()) return;
      addRubroPreset(configPanel.category, {
          name: newPresetName,
          unit: 'u', // Default unit
          category: configPanel.category,
          laborCost: 0,
          dailyYield: 1
      });
      setNewPresetName('');
  };

  const handleDeletePreset = (name: string) => {
      removeRubroPreset(configPanel.category, name);
  };

  // Render logic
  return (
    <div className="flex h-full gap-6 font-sans relative">
      
      {/* LEFT SIDEBAR: STAGES SELECTION */}
      <div className="w-72 flex-shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm h-full print:hidden">
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
      <div className="flex-1 flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative print:hidden">
          
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
                      <button onClick={() => setShowPrintPreview(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
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
                                                            <td className="p-2" onDoubleClick={() => setEditingQuantityId(row.item.id)}>
                                                                {editingQuantityId === row.item.id ? (
                                                                    <input 
                                                                        type="number"
                                                                        autoFocus
                                                                        className="w-full text-center p-1 border border-blue-500 rounded text-sm font-bold text-slate-800 focus:outline-none shadow-sm"
                                                                        value={row.item.quantity}
                                                                        onChange={(e) => updateBudgetItem(row.item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                                                        onBlur={() => setEditingQuantityId(null)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') setEditingQuantityId(null);
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div className="text-center text-sm font-bold text-slate-700 cursor-pointer hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors" title="Doble clic para editar">
                                                                        {row.item.quantity}
                                                                    </div>
                                                                )}
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
                                                        <td colSpan={9} className="p-2">
                                                            <button 
                                                                onClick={() => handleQuickAddTask(rubro)} 
                                                                className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-xs font-bold text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <Plus size={14} /> Agregar Nueva Tarea en {rubro}
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

                          {/* Presets Section */}
                          {configPanel.mode === 'add' && (
                              <div className="space-y-3 pt-4 border-t border-slate-100">
                                  <div className="flex justify-between items-center">
                                      <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                          <Sparkles size={12} className="text-yellow-500" /> Tareas Típicas / Sugeridas
                                      </label>
                                      <button 
                                          onClick={() => setManagePresetsMode(!managePresetsMode)}
                                          className="text-[10px] text-blue-600 font-bold hover:underline"
                                      >
                                          {managePresetsMode ? 'Terminar Edición' : 'Gestionar Lista'}
                                      </button>
                                  </div>
                                  
                                  {managePresetsMode && (
                                      <div className="flex gap-2 mb-2">
                                          <input 
                                              className="flex-1 p-2 text-xs border border-slate-300 rounded"
                                              placeholder="Nombre de nueva tarea típica..."
                                              value={newPresetName}
                                              onChange={e => setNewPresetName(e.target.value)}
                                          />
                                          <button 
                                              onClick={handleAddPreset}
                                              className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700"
                                          >
                                              <Plus size={14} />
                                          </button>
                                      </div>
                                  )}

                                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                                      {(rubroPresets[configPanel.category] || []).map((preset, idx) => (
                                          <div key={idx} className="flex items-center gap-2 group">
                                              <button 
                                                  onClick={() => handleSelectPreset(preset)}
                                                  className="flex-1 text-left p-2 text-xs bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded transition-colors flex justify-between items-center"
                                              >
                                                  <span className="font-medium text-slate-700">{preset.name}</span>
                                                  <span className="text-[10px] text-slate-400 bg-white px-1 rounded border border-slate-100">{preset.unit}</span>
                                              </button>
                                              {managePresetsMode && (
                                                  <button 
                                                      onClick={() => handleDeletePreset(preset.name!)}
                                                      className="p-2 text-red-400 hover:bg-red-50 rounded bg-red-50"
                                                  >
                                                      <Trash2 size={14} />
                                                  </button>
                                              )}
                                          </div>
                                      ))}
                                      {(rubroPresets[configPanel.category] || []).length === 0 && (
                                          <div className="text-center p-4 text-xs text-slate-400 italic bg-slate-50 rounded border border-dashed border-slate-200">
                                              No hay tareas típicas definidas para este rubro.
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}

                          {/* Quantity Input */}
                          <div className="space-y-2 pt-4 border-t border-slate-100">
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

          {/* PRINT PREVIEW MODAL */}
          {showPrintPreview && (
              <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
                  {/* Dynamic Print Styles */}
                  <style>
                    {`
                        @media print {
                            @page {
                                size: ${printOptions.paperSize} ${printOptions.orientation};
                                margin: 10mm;
                            }
                            body {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                        }
                    `}
                  </style>

                  <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col print:h-auto print:w-full print:max-w-none print:shadow-none print:rounded-none">
                      
                      {/* HEADER (Hidden on Print) */}
                      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 print:hidden">
                          <div>
                              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                  <Printer size={20} className="text-blue-600"/> Vista Previa de Impresión
                              </h3>
                              <p className="text-xs text-slate-500">Configure qué columnas desea incluir en el reporte.</p>
                          </div>
                          <div className="flex items-center gap-3">
                              <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200">
                                  <Printer size={16} /> Imprimir Ahora
                              </button>
                              <button onClick={() => setShowPrintPreview(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                                  <X size={20} />
                              </button>
                          </div>
                      </div>

                      <div className="flex flex-1 overflow-hidden print:overflow-visible print:h-auto">
                          {/* SIDEBAR CONFIG (Hidden on Print) */}
                          <div className="w-80 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto print:hidden flex flex-col gap-6">
                              
                              {/* Page Settings */}
                              <div>
                                  <h4 className="font-bold text-xs text-slate-500 uppercase mb-3 flex items-center gap-2">
                                      <Settings size={12} /> Configuración de Página
                                  </h4>
                                  <div className="space-y-3">
                                      <div>
                                          <label className="text-xs font-bold text-slate-600 block mb-1">Tamaño de Hoja</label>
                                          <select 
                                              className="w-full p-2 text-xs border border-slate-300 rounded bg-white"
                                              value={printOptions.paperSize}
                                              onChange={e => setPrintOptions({...printOptions, paperSize: e.target.value})}
                                          >
                                              <option value="a4">A4 (210mm x 297mm)</option>
                                              <option value="letter">Carta (Letter)</option>
                                              <option value="legal">Oficio (Legal)</option>
                                          </select>
                                      </div>
                                      <div>
                                          <label className="text-xs font-bold text-slate-600 block mb-1">Orientación</label>
                                          <div className="flex gap-2">
                                              <button 
                                                  onClick={() => setPrintOptions({...printOptions, orientation: 'portrait'})}
                                                  className={`flex-1 py-2 text-xs font-bold rounded border ${printOptions.orientation === 'portrait' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-600'}`}
                                              >
                                                  Vertical
                                              </button>
                                              <button 
                                                  onClick={() => setPrintOptions({...printOptions, orientation: 'landscape'})}
                                                  className={`flex-1 py-2 text-xs font-bold rounded border ${printOptions.orientation === 'landscape' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-600'}`}
                                              >
                                                  Horizontal
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              </div>

                              {/* Content Options */}
                              <div>
                                  <h4 className="font-bold text-xs text-slate-500 uppercase mb-3 flex items-center gap-2">
                                      <CheckSquare size={12} /> Contenido del Reporte
                                  </h4>
                                  <div className="space-y-2">
                                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                          <input type="checkbox" checked={printOptions.showQuantity} onChange={e => setPrintOptions({...printOptions, showQuantity: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                          Mostrar Cantidad
                                      </label>
                                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                          <input type="checkbox" checked={printOptions.showUnitPrice} onChange={e => setPrintOptions({...printOptions, showUnitPrice: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                          Mostrar Precios Unitarios
                                      </label>
                                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                          <input type="checkbox" checked={printOptions.showMatSubtotal} onChange={e => setPrintOptions({...printOptions, showMatSubtotal: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                          Mostrar Subtotal Materiales
                                      </label>
                                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                          <input type="checkbox" checked={printOptions.showLabSubtotal} onChange={e => setPrintOptions({...printOptions, showLabSubtotal: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                          Mostrar Subtotal Mano de Obra
                                      </label>
                                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                          <input type="checkbox" checked={printOptions.showTotal} onChange={e => setPrintOptions({...printOptions, showTotal: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                          Mostrar Total Ítem
                                      </label>
                                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded bg-blue-50 border border-blue-100">
                                          <input type="checkbox" checked={printOptions.showIncidence} onChange={e => setPrintOptions({...printOptions, showIncidence: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                          Mostrar Incidencia %
                                      </label>
                                      <div className="h-px bg-slate-200 my-2"></div>
                                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                          <input type="checkbox" checked={printOptions.showCategoryHeaders} onChange={e => setPrintOptions({...printOptions, showCategoryHeaders: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                          Agrupar por Rubros
                                      </label>
                                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                          <input type="checkbox" checked={printOptions.showFooter} onChange={e => setPrintOptions({...printOptions, showFooter: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                          Mostrar Totales Generales
                                      </label>
                                  </div>
                              </div>

                              {/* Customization */}
                              <div>
                                  <h4 className="font-bold text-xs text-slate-500 uppercase mb-3 flex items-center gap-2">
                                      <Edit3 size={12} /> Personalización
                                  </h4>
                                  <div className="space-y-3">
                                      <div>
                                          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-2 cursor-pointer">
                                              <input type="checkbox" checked={printOptions.showIcon} onChange={e => setPrintOptions({...printOptions, showIcon: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500"/>
                                              Incluir Logo / Ícono
                                          </label>
                                          {printOptions.showIcon && (
                                              <div className="flex items-center gap-2">
                                                  {printLogo && <img src={printLogo} alt="Logo" className="w-8 h-8 object-contain border rounded bg-white" />}
                                                  <label className="flex-1 cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs py-1.5 px-3 rounded text-center transition-colors">
                                                      Subir Imagen...
                                                      <input 
                                                          type="file" 
                                                          accept="image/*" 
                                                          className="hidden" 
                                                          onChange={(e) => {
                                                              const file = e.target.files?.[0];
                                                              if (file) {
                                                                  const reader = new FileReader();
                                                                  reader.onload = (ev) => setPrintLogo(ev.target?.result as string);
                                                                  reader.readAsDataURL(file);
                                                              }
                                                          }}
                                                      />
                                                  </label>
                                              </div>
                                          )}
                                      </div>
                                      <div>
                                          <label className="text-xs font-bold text-slate-600 block mb-1">Texto Personalizado (Encabezado)</label>
                                          <textarea 
                                              className="w-full p-2 text-xs border border-slate-300 rounded bg-white h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                              placeholder="Ej: Presupuesto válido por 15 días..."
                                              value={printOptions.customText}
                                              onChange={e => setPrintOptions({...printOptions, customText: e.target.value})}
                                          />
                                      </div>
                                  </div>
                              </div>

                          </div>

                          {/* PREVIEW CONTENT */}
                          <div className="flex-1 overflow-auto bg-slate-100 p-8 print:p-0 print:overflow-visible print:bg-white flex justify-center">
                              <div 
                                className={`bg-white shadow-lg border border-slate-200 p-8 print:shadow-none print:border-none print:p-0 transition-all duration-300 origin-top`}
                                style={{
                                    width: printOptions.paperSize === 'a4' 
                                        ? (printOptions.orientation === 'portrait' ? '210mm' : '297mm') 
                                        : printOptions.paperSize === 'legal' 
                                            ? (printOptions.orientation === 'portrait' ? '216mm' : '356mm')
                                            : (printOptions.orientation === 'portrait' ? '216mm' : '279mm'), // Letter
                                    minHeight: printOptions.paperSize === 'a4' 
                                        ? (printOptions.orientation === 'portrait' ? '297mm' : '210mm') 
                                        : printOptions.paperSize === 'legal' 
                                            ? (printOptions.orientation === 'portrait' ? '356mm' : '216mm')
                                            : (printOptions.orientation === 'portrait' ? '279mm' : '216mm') // Letter
                                }}
                              >
                                  
                                  {/* Report Header */}
                                  <div className="mb-6 border-b-2 border-slate-800 pb-4">
                                      <div className="flex justify-between items-start mb-4">
                                          <div>
                                              <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{project.name}</h1>
                                              <p className="text-sm text-slate-600 font-bold">Cómputo y Presupuesto de Obra</p>
                                          </div>
                                          {printOptions.showIcon && printLogo && (
                                              <img src={printLogo} alt="Project Logo" className="h-16 object-contain" />
                                          )}
                                      </div>
                                      
                                      <div className="flex justify-between items-end mt-2">
                                          <div className="text-xs text-slate-500 space-y-1">
                                              <p><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString()}</p>
                                              {project.client && <p><strong>Cliente:</strong> {project.client}</p>}
                                              {project.address && <p><strong>Ubicación:</strong> {project.address}</p>}
                                          </div>
                                          <div className="text-right">
                                              <p className="text-xs text-slate-400">Generado por Construsoft</p>
                                          </div>
                                      </div>

                                      {printOptions.customText && (
                                          <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded text-xs text-slate-600 italic whitespace-pre-wrap">
                                              {printOptions.customText}
                                          </div>
                                      )}
                                  </div>

                                  {/* Report Table */}
                                  <table className="w-full text-left border-collapse text-xs">
                                      <thead>
                                          <tr className="border-b-2 border-slate-800">
                                              <th className="py-2 font-bold text-slate-700 uppercase">Ítem / Descripción</th>
                                              <th className="py-2 text-center font-bold text-slate-700 w-12">Unid.</th>
                                              {printOptions.showQuantity && <th className="py-2 text-center font-bold text-slate-700 w-16">Cant.</th>}
                                              {printOptions.showUnitPrice && <th className="py-2 text-right font-bold text-slate-700 w-24">P. Unit.</th>}
                                              {printOptions.showMatSubtotal && <th className="py-2 text-right font-bold text-slate-700 w-24">Mat. Total</th>}
                                              {printOptions.showLabSubtotal && <th className="py-2 text-right font-bold text-slate-700 w-24">M.O. Total</th>}
                                              {printOptions.showTotal && <th className="py-2 text-right font-bold text-slate-900 w-28">Total</th>}
                                              {printOptions.showIncidence && <th className="py-2 text-right font-bold text-slate-900 w-16">% Inc.</th>}
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {Array.from(selectedRubros).map((rubro) => {
                                              const items = budgetData.grouped[rubro] || [];
                                              if (items.length === 0) return null;
                                              const totals = budgetData.categoryTotals[rubro];
                                              const rubroIncidence = grandTotals.finalTotal > 0 ? (totals.total / grandTotals.finalTotal) * 100 : 0;

                                              return (
                                                  <React.Fragment key={rubro}>
                                                      {printOptions.showCategoryHeaders && (
                                                          <tr className="bg-slate-100 break-inside-avoid">
                                                              <td colSpan={10} className="py-2 px-2 font-bold text-slate-800 uppercase text-[10px] tracking-wider border-t border-slate-300 mt-4">
                                                                  {rubro}
                                                              </td>
                                                          </tr>
                                                      )}
                                                      {items.map((row) => {
                                                          const itemIncidence = grandTotals.finalTotal > 0 ? (row.totalItem / grandTotals.finalTotal) * 100 : 0;
                                                          return (
                                                            <tr key={row.item.id} className="border-b border-slate-100 break-inside-avoid">
                                                                <td className="py-1.5 pr-2">
                                                                    <div className="font-medium text-slate-800">{row.task.name}</div>
                                                                    <div className="text-[9px] text-slate-500">{row.task.code}</div>
                                                                </td>
                                                                <td className="py-1.5 text-center text-slate-500">{row.task.unit}</td>
                                                                {printOptions.showQuantity && <td className="py-1.5 text-center font-mono font-bold text-slate-700">{row.item.quantity}</td>}
                                                                {printOptions.showUnitPrice && <td className="py-1.5 text-right font-mono text-slate-600">${row.analysis.totalUnitCost.toFixed(2)}</td>}
                                                                {printOptions.showMatSubtotal && <td className="py-1.5 text-right font-mono text-slate-600">${row.totalMatEq.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>}
                                                                {printOptions.showLabSubtotal && <td className="py-1.5 text-right font-mono text-slate-600">${row.totalLab.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>}
                                                                {printOptions.showTotal && <td className="py-1.5 text-right font-mono font-bold text-slate-900">${row.totalItem.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>}
                                                                {printOptions.showIncidence && <td className="py-1.5 text-right font-mono text-slate-500 text-[10px]">{itemIncidence.toFixed(2)}%</td>}
                                                            </tr>
                                                          );
                                                      })}
                                                      {printOptions.showCategoryHeaders && (
                                                          <tr className="break-inside-avoid bg-slate-50 border-t border-slate-300">
                                                              <td colSpan={2} className="py-2 text-right font-bold text-[10px] text-slate-500 uppercase">Subtotal {rubro}</td>
                                                              {printOptions.showQuantity && <td></td>}
                                                              {printOptions.showUnitPrice && <td></td>}
                                                              {printOptions.showMatSubtotal && <td className="py-2 text-right font-mono font-bold text-slate-700">${totals.mat.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>}
                                                              {printOptions.showLabSubtotal && <td className="py-2 text-right font-mono font-bold text-slate-700">${totals.lab.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>}
                                                              {printOptions.showTotal && <td className="py-2 text-right font-mono font-bold text-slate-900">${totals.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>}
                                                              {printOptions.showIncidence && <td className="py-2 text-right font-mono font-bold text-slate-900">{rubroIncidence.toFixed(2)}%</td>}
                                                          </tr>
                                                      )}
                                                  </React.Fragment>
                                              );
                                          })}
                                      </tbody>
                                  </table>

                                  {/* Footer Totals */}
                                  {printOptions.showFooter && (
                                      <div className="mt-8 border-t-2 border-slate-800 pt-4 break-inside-avoid">
                                          <div className="flex justify-end gap-8">
                                              {printOptions.showMatSubtotal && (
                                                  <div className="text-right">
                                                      <div className="text-[10px] font-bold text-slate-500 uppercase">Total Materiales</div>
                                                      <div className="text-sm font-mono font-bold text-slate-800">${grandTotals.mat.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                                  </div>
                                              )}
                                              {printOptions.showLabSubtotal && (
                                                  <div className="text-right">
                                                      <div className="text-[10px] font-bold text-slate-500 uppercase">Total Mano de Obra</div>
                                                      <div className="text-sm font-mono font-bold text-slate-800">${grandTotals.lab.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                                  </div>
                                              )}
                                              <div className="text-right">
                                                  <div className="text-[10px] font-bold text-slate-500 uppercase">TOTAL GENERAL</div>
                                                  <div className="text-xl font-black text-slate-900 font-mono">${grandTotals.finalTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                              </div>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

      </div>
    </div>
  );
};
