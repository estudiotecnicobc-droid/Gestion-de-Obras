import React, { useState, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { calculateUnitPrice } from '../services/calculationService';
import { Trash2, Plus, Search, Settings, X, Save, Package, Wrench, Hammer, AlertCircle, BookOpen, CheckSquare, Square, List, Info, CheckCircle2, ClipboardCopy, Truck } from 'lucide-react';
import { Task, Material, Tool, ProjectTemplate } from '../types';
import { PROJECT_TEMPLATES } from '../constants';

export const BudgetEditor: React.FC = () => {
  const { 
    project, tasks, materials, yields, tools, toolYields, rubros,
    addBudgetItem, removeBudgetItem, updateBudgetItem, addTask,
    updateTask, addTaskYield, removeTaskYield, addTaskToolYield, removeTaskToolYield,
    loadTemplate,
    // Indexes
    yieldsIndex, materialsMap, toolYieldsIndex, toolsMap
  } = useERP();

  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Estado para el panel de edición avanzada
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [resourceToAdd, setResourceToAdd] = useState<string>('');
  const [resourceType, setResourceType] = useState<'material' | 'tool'>('material');

  // Estado para el Modal de Plantillas
  const [activeTemplate, setActiveTemplate] = useState<ProjectTemplate | null>(null);
  const [selectedTemplateTaskIds, setSelectedTemplateTaskIds] = useState<Set<string>>(new Set());

  // Filtrado y Agrupación de tareas para el buscador
  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    const lower = searchTerm.toLowerCase();
    return tasks.filter(t => 
      t.name.toLowerCase().includes(lower) || 
      t.category?.toLowerCase().includes(lower)
    );
  }, [tasks, searchTerm]);

  const tasksByRubro = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    // Inicializar rubros vacíos para mantener orden
    if (!searchTerm) {
        rubros.forEach(rubro => { grouped[rubro] = []; });
    }
    grouped['Otros'] = [];

    filteredTasks.forEach(task => {
      const cat = task.category && rubros.includes(task.category) ? task.category : 'Otros';
      if (grouped[cat] === undefined) grouped[cat] = [];
      grouped[cat].push(task);
    });

    return grouped;
  }, [filteredTasks, searchTerm, rubros]);

  const handleAdd = () => {
    if (!selectedTaskId) return;
    addBudgetItem({
      id: crypto.randomUUID(),
      taskId: selectedTaskId,
      quantity: inputQty
    });
  };

  // --- Lógica de Pegado desde Excel ---
  const handlePasteFromExcel = async () => {
      try {
          const text = await navigator.clipboard.readText();
          if (!text) return;

          const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
          let addedCount = 0;

          rows.forEach(row => {
              // Expected Format: Name \t Unit \t Category (Optional) \t LaborCost (Optional)
              const cols = row.split('\t');
              if (cols.length >= 2) {
                  const name = cols[0].trim();
                  const unit = cols[1].trim();
                  const category = cols[2]?.trim() || 'GENERAL';
                  const laborCost = parseFloat(cols[3]?.trim()) || 0;

                  // Create Task
                  addTask({
                      id: crypto.randomUUID(),
                      organizationId: 'org_a', // Should use context org in real app
                      name,
                      unit,
                      category,
                      laborCost,
                      dailyYield: 1 // Default
                  });
                  addedCount++;
              }
          });

          if (addedCount > 0) {
              alert(`Se importaron ${addedCount} tareas exitosamente.`);
          } else {
              alert("No se detectó un formato válido. Use: Nombre | Unidad | Categoría");
          }

      } catch (err) {
          console.error('Failed to read clipboard contents: ', err);
          alert("Permiso de portapapeles denegado o error de lectura.");
      }
  };

  // --- Lógica del Modal de Plantillas ---

  const handleOpenTemplateModal = (templateId: string) => {
    const tmpl = PROJECT_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
        setActiveTemplate(tmpl);
        // Por defecto seleccionar todas
        setSelectedTemplateTaskIds(new Set(tmpl.tasks.map(t => t.id)));
    }
  };

  const toggleTemplateTask = (taskId: string) => {
      const newSet = new Set(selectedTemplateTaskIds);
      if (newSet.has(taskId)) {
          newSet.delete(taskId);
      } else {
          newSet.add(taskId);
      }
      setSelectedTemplateTaskIds(newSet);
  };

  const toggleAllTemplateTasks = () => {
      if (!activeTemplate) return;
      if (selectedTemplateTaskIds.size === activeTemplate.tasks.length) {
          setSelectedTemplateTaskIds(new Set());
      } else {
          setSelectedTemplateTaskIds(new Set(activeTemplate.tasks.map(t => t.id)));
      }
  };

  const confirmTemplateImport = () => {
      if (!activeTemplate) return;
      
      const tasksToImport = activeTemplate.tasks.filter(t => selectedTemplateTaskIds.has(t.id));
      
      if (tasksToImport.length === 0) {
          alert("Seleccione al menos una tarea para importar.");
          return;
      }

      // Crear una "Plantilla parcial" para pasar al contexto
      const partialTemplate: ProjectTemplate = {
          ...activeTemplate,
          tasks: tasksToImport
      };

      loadTemplate(partialTemplate);
      setActiveTemplate(null);
  };

  const tasksByRubroInTemplate = useMemo(() => {
      if (!activeTemplate) return {};
      const grouped: Record<string, Task[]> = {};
      activeTemplate.tasks.forEach(task => {
          const cat = task.category || 'General';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(task);
      });
      return grouped;
  }, [activeTemplate]);

  // --- Fin Lógica Modal ---

  // Cálculo del APU para la tarea en edición
  const editingAnalysis = useMemo(() => {
    if (!editingTask) return null;
    return calculateUnitPrice(editingTask, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap);
  }, [editingTask, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap]);

  const currentTaskMaterials = useMemo(() => {
    if (!editingTask) return [];
    return (yieldsIndex[editingTask.id] || []).map(y => ({
      ...y,
      data: materialsMap[y.materialId]
    }));
  }, [editingTask, yieldsIndex, materialsMap]);

  const currentTaskTools = useMemo(() => {
    if (!editingTask) return [];
    return (toolYieldsIndex[editingTask.id] || []).map(y => ({
      ...y,
      data: toolsMap[y.toolId]
    }));
  }, [editingTask, toolYieldsIndex, toolsMap]);

  const handleAddResourceToTask = () => {
    if (!editingTask || !resourceToAdd) return;
    
    if (resourceType === 'material') {
        addTaskYield({ taskId: editingTask.id, materialId: resourceToAdd, quantity: 1 });
    } else {
        addTaskToolYield({ taskId: editingTask.id, toolId: resourceToAdd, hoursPerUnit: 1 });
    }
    setResourceToAdd('');
  };

  return (
    <div className="flex h-full gap-6 relative">
      {/* Main Content (Left) */}
      <div className="flex-1 space-y-6 h-full flex flex-col">
        {/* Top Bar: Selector Inteligente */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Settings className="text-blue-600" size={24} /> Editor de Cómputo y Presupuesto
              </h2>
              {/* Botones de Plantillas Rápidas */}
              <div className="flex flex-wrap gap-2">
                 <span className="text-[10px] font-bold text-slate-400 uppercase self-center mr-1">Cargar Modelo:</span>
                 {PROJECT_TEMPLATES.map(tmpl => (
                     <button
                        key={tmpl.id}
                        onClick={() => handleOpenTemplateModal(tmpl.id)}
                        className="text-xs bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded-full font-medium transition-colors border border-slate-200 flex items-center gap-2 shadow-sm"
                        title={tmpl.description}
                     >
                        <BookOpen size={12} /> {tmpl.name}
                     </button>
                 ))}
              </div>
          </div>
          
          <div className="flex flex-col xl:flex-row gap-4 items-start bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex-1 w-full relative">
              <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Buscar y Seleccionar Tarea</label>
                  <button 
                    onClick={handlePasteFromExcel}
                    className="text-[10px] flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 transition-colors"
                    title="Copiar celdas de Excel: Nombre | Unidad | Categoría"
                  >
                      <ClipboardCopy size={10} /> Pegar desde Excel
                  </button>
              </div>
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="Escriba para filtrar (ej: Muro, Losa, Pintura)..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
              
              {/* Custom List Box */}
              <div className="mt-2 border border-slate-300 rounded-lg bg-white h-48 overflow-y-auto shadow-inner">
                {Object.keys(tasksByRubro).length === 0 && <div className="p-3 text-xs text-slate-400 italic text-center">No hay tareas disponibles.</div>}
                
                {Object.keys(tasksByRubro).map(rubro => {
                   const groupTasks = tasksByRubro[rubro];
                   if (!groupTasks || groupTasks.length === 0) return null;
                   return (
                     <div key={rubro}>
                       <div className="sticky top-0 bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                         {rubro}
                       </div>
                       {groupTasks.map(t => (
                         <div 
                            key={t.id} 
                            onClick={() => setSelectedTaskId(t.id)}
                            className={`px-3 py-2 text-xs border-b border-slate-50 cursor-pointer flex justify-between items-center transition-colors ${selectedTaskId === t.id ? 'bg-blue-600 text-white font-medium' : 'hover:bg-blue-50 text-slate-700'}`}
                         >
                            <span>{t.name}</span>
                            <span className={`text-[10px] px-1.5 rounded border ${selectedTaskId === t.id ? 'bg-blue-500 text-white border-blue-400' : 'bg-white text-slate-400 border-slate-200'}`}>{t.unit}</span>
                         </div>
                       ))}
                     </div>
                   );
                })}
              </div>
            </div>
            
            <div className="w-full xl:w-48 flex flex-col gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cantidad</label>
                    <input 
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={inputQty}
                        onChange={(e) => setInputQty(parseFloat(e.target.value))}
                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-center"
                    />
                </div>
                <button 
                onClick={handleAdd}
                disabled={!selectedTaskId}
                className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold shadow-md transition-transform active:scale-95"
                >
                <Plus size={18} /> Agregar
                </button>
            </div>
          </div>
        </div>

        {/* List Area */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex-1 overflow-hidden flex flex-col">
           <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-semibold text-slate-700 text-sm">Ítems del Presupuesto Actual</h3>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{project.items.length} ítems</span>
           </div>
           <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] uppercase text-slate-500 font-semibold border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="p-2 pl-4">Descripción</th>
                    <th className="p-2 text-right">Cant.</th>
                    <th className="p-2 text-right">Precio Unit.</th>
                    <th className="p-2 text-right">Subtotal</th>
                    <th className="p-2 text-center">Config</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400 italic text-sm">
                        No hay ítems cargados. Utilice el buscador superior o las plantillas para agregar actividades.
                      </td>
                    </tr>
                  ) : (
                    project.items.map(item => {
                      const task = tasks.find(t => t.id === item.taskId);
                      if (!task) return null;
                      
                      const analysis = calculateUnitPrice(task, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap);
                      const subtotal = analysis.totalUnitCost * item.quantity;
                      const isEditing = editingTask?.id === task.id;

                      return (
                        <tr key={item.id} className={`hover:bg-blue-50/30 transition-colors ${isEditing ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                          <td className="p-2 pl-4">
                            <div className="font-bold text-slate-800 text-xs">{task.name}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5">{task.category || 'Sin Categoría'}</div>
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                                <input 
                                  type="number"
                                  className="w-16 text-right p-1 bg-slate-700 text-white font-bold border border-slate-600 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                                  value={item.quantity}
                                  onChange={(e) => updateBudgetItem(item.id, { quantity: parseFloat(e.target.value) })}
                                />
                                <span className="text-[10px] text-slate-500 font-medium w-6 text-left ml-1">{task.unit}</span>
                            </div>
                          </td>
                          <td className="p-2 text-right text-slate-600 font-mono text-xs">
                            ${analysis.totalUnitCost.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-bold text-slate-800 font-mono text-xs">
                            ${subtotal.toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex justify-center gap-1">
                                <button 
                                  onClick={() => setEditingTask(task)}
                                  className={`p-1.5 rounded transition-colors ${isEditing ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'}`}
                                  title="Configurar Análisis de Precios"
                                >
                                  <Settings size={14} />
                                </button>
                                <button 
                                  onClick={() => removeBudgetItem(item.id)}
                                  className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                                  title="Eliminar Ítem"
                                >
                                  <Trash2 size={14} />
                                </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* Side Editor Panel (Slide-over) */}
      {editingTask && editingAnalysis && (
          <aside className="w-[450px] bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full animate-in slide-in-from-right z-20">
             {/* Panel Header */}
             <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
                <div>
                    <span className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">Ingeniería de Costos</span>
                    <h3 className="font-bold text-lg text-slate-800 leading-tight mt-1">{editingTask.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">Editando Análisis de Precios Unitarios (APU)</p>
                </div>
                <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                    <X size={20} />
                </button>
             </div>

             {/* Panel Content */}
             <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* 1. General Config */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 pb-2 border-b border-slate-100">
                        <Hammer size={14} className="text-slate-400" /> Configuración Base
                    </h4>
                    
                    <div className="space-y-3">
                        <div>
                             <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Nombre de la Tarea</label>
                             <input 
                                type="text" 
                                className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={editingTask.name}
                                onChange={(e) => updateTask(editingTask.id, { name: e.target.value })}
                            />
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Unidad</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-center font-bold"
                                    value={editingTask.unit}
                                    onChange={(e) => updateTask(editingTask.id, { unit: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Mano Obra ($/U)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={editingTask.laborCost}
                                    onChange={(e) => updateTask(editingTask.id, { laborCost: parseFloat(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Rend (U/Día)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={editingTask.dailyYield}
                                    onChange={(e) => updateTask(editingTask.id, { dailyYield: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Fixed Costs (Added) */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 pb-2 border-b border-slate-100 justify-between">
                        <span className="flex items-center gap-2"><Truck size={14} className="text-emerald-500" /> Costos Fijos / Flete</span>
                        <span className="text-emerald-600 font-mono">${(editingTask.fixedCost || 0).toFixed(2)}</span>
                    </h4>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-2">
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Descripción</label>
                            <input 
                                type="text"
                                placeholder="Ej: Flete o Adicional Gremio"
                                className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                                value={editingTask.fixedCostDescription || ''}
                                onChange={(e) => updateTask(editingTask.id, { fixedCostDescription: e.target.value })}
                            />
                        </div>
                        <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                            <span className="text-xs font-medium text-slate-600">Valor Adicional por Unidad</span>
                            <div className="flex items-center gap-1">
                                <span className="text-slate-400 text-xs">$</span>
                                <input 
                                    type="number" 
                                    className="w-20 text-right text-sm font-bold text-slate-700 outline-none"
                                    value={editingTask.fixedCost || 0}
                                    onChange={(e) => updateTask(editingTask.id, { fixedCost: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Materials Config */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 pb-2 border-b border-slate-100 justify-between">
                        <span className="flex items-center gap-2"><Package size={14} className="text-blue-500" /> Materiales</span>
                        <span className="text-blue-600 font-mono">${editingAnalysis.materialCost.toFixed(2)}</span>
                    </h4>
                    
                    <div className="space-y-2">
                        {currentTaskMaterials.map(item => (
                            <div key={item.materialId} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-slate-700">{item.data?.name}</div>
                                    <div className="text-[10px] text-slate-400">{item.data?.unit} • Costo Base: ${item.data?.cost}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number"
                                        className="w-16 text-right p-1 text-xs border border-slate-300 rounded bg-white"
                                        value={item.quantity}
                                        onChange={(e) => addTaskYield({ taskId: editingTask.id, materialId: item.materialId, quantity: parseFloat(e.target.value) })}
                                    />
                                    <button 
                                        onClick={() => removeTaskYield(editingTask.id, item.materialId)}
                                        className="text-slate-400 hover:text-red-500 p-1"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. Tools Config */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 pb-2 border-b border-slate-100 justify-between">
                        <span className="flex items-center gap-2"><Wrench size={14} className="text-purple-500" /> Equipos</span>
                        <span className="text-purple-600 font-mono">${editingAnalysis.toolCost.toFixed(2)}</span>
                    </h4>
                    
                    <div className="space-y-2">
                        {currentTaskTools.map(item => (
                            <div key={item.toolId} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-slate-700">{item.data?.name}</div>
                                    <div className="text-[10px] text-slate-400">Horas/Unid • Tarifa: ${item.data?.costPerHour}/h</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number"
                                        className="w-16 text-right p-1 text-xs border border-slate-300 rounded bg-white"
                                        value={item.hoursPerUnit}
                                        onChange={(e) => addTaskToolYield({ taskId: editingTask.id, toolId: item.toolId, hoursPerUnit: parseFloat(e.target.value) })}
                                    />
                                    <button 
                                        onClick={() => removeTaskToolYield(editingTask.id, item.toolId)}
                                        className="text-slate-400 hover:text-red-500 p-1"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Resource Form */}
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase">Agregar Recurso a la Tarea</label>
                    <div className="flex gap-2 mb-2">
                        <button 
                            onClick={() => setResourceType('material')} 
                            className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${resourceType === 'material' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Material
                        </button>
                        <button 
                            onClick={() => setResourceType('tool')} 
                            className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${resourceType === 'tool' ? 'bg-white shadow text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Equipo
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <select 
                            className="flex-1 text-xs p-2 border border-slate-300 rounded bg-white focus:outline-none"
                            value={resourceToAdd}
                            onChange={(e) => setResourceToAdd(e.target.value)}
                        >
                            <option value="">-- Seleccionar --</option>
                            {resourceType === 'material' 
                                ? materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit}) - ${m.cost}</option>)
                                : tools.map(t => <option key={t.id} value={t.id}>{t.name} - ${t.costPerHour}/h</option>)
                            }
                        </select>
                        <button 
                            onClick={handleAddResourceToTask}
                            disabled={!resourceToAdd}
                            className="bg-slate-800 text-white p-2 rounded hover:bg-black disabled:opacity-50"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2 items-start">
                    <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-amber-800 leading-tight">
                        <strong>Nota Importante:</strong> Los cambios realizados aquí actualizarán la definición de la tarea en la base de datos, afectando a todos los ítems que usen este código de actividad.
                    </p>
                </div>

             </div>

             {/* Footer Summary */}
             <div className="p-5 border-t border-slate-200 bg-slate-50">
                 <div className="flex justify-between items-center mb-4">
                     <span className="text-sm text-slate-500 font-medium">Nuevo Precio Unitario:</span>
                     <span className="text-xl font-bold text-blue-600 font-mono">${editingAnalysis.totalUnitCost.toFixed(2)}</span>
                 </div>
                 <button 
                    onClick={() => setEditingTask(null)}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2"
                 >
                    <Save size={18} /> Finalizar Edición
                 </button>
             </div>
          </aside>
      )}

      {/* --- MODAL DE SELECCIÓN DE PLANTILLA --- */}
      {activeTemplate && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                  
                  {/* Header Modal */}
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                      <div>
                          <div className="flex items-center gap-2 text-blue-600 mb-1">
                              <BookOpen size={20} />
                              <span className="text-xs font-bold uppercase tracking-wider">Asistente de Importación</span>
                          </div>
                          <h3 className="text-xl font-bold text-slate-800">{activeTemplate.name}</h3>
                          <p className="text-sm text-slate-500 mt-1">{activeTemplate.description}</p>
                      </div>
                      <button onClick={() => setActiveTemplate(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Body - Task List */}
                  <div className="flex-1 overflow-y-auto p-6 bg-white">
                      <div className="flex justify-between items-center mb-4">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              <List size={16} /> Tareas Disponibles
                          </h4>
                          <button 
                            onClick={toggleAllTemplateTasks}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                              {selectedTemplateTaskIds.size === activeTemplate.tasks.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
                          </button>
                      </div>

                      <div className="space-y-6">
                          {Object.keys(tasksByRubroInTemplate).map((category) => (
                              <div key={category} className="space-y-2">
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">
                                      {category}
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                      {tasksByRubroInTemplate[category].map(task => {
                                          const isSelected = selectedTemplateTaskIds.has(task.id);
                                          return (
                                              <div 
                                                key={task.id} 
                                                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                                                onClick={() => toggleTemplateTask(task.id)}
                                              >
                                                  <div className={`mt-0.5 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`}>
                                                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                  </div>
                                                  <div className="flex-1">
                                                      <div className={`text-sm font-medium ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>{task.name}</div>
                                                      <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                                                          <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">Unidad: {task.unit}</span>
                                                          <span>Rend: {task.dailyYield}/dia</span>
                                                          <span>MO: ${task.laborCost}</span>
                                                      </div>
                                                  </div>
                                              </div>
                                          )
                                      })}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle2 size={18} className={selectedTemplateTaskIds.size > 0 ? "text-green-500" : "text-slate-300"} />
                          <span><strong>{selectedTemplateTaskIds.size}</strong> ítems seleccionados</span>
                      </div>
                      <div className="flex gap-3">
                          <button 
                              onClick={() => setActiveTemplate(null)}
                              className="px-5 py-2.5 rounded-lg font-bold text-slate-500 hover:bg-slate-200 transition-colors text-sm"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={confirmTemplateImport}
                              disabled={selectedTemplateTaskIds.size === 0}
                              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              <Package size={18} />
                              Importar al Presupuesto
                          </button>
                      </div>
                  </div>

              </div>
          </div>
      )}

    </div>
  );
};