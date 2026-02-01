import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { calculateUnitPrice } from '../services/calculationService';
import { 
  Upload, FileText, CheckCircle, AlertTriangle, RefreshCcw, 
  Database, Wrench, Package, ListChecks, Plus, Trash2, Edit2, Save, X, Users, Clock, BarChart3, Tags, ClipboardCopy, ArrowRight, Calculator, FileSpreadsheet, Settings, Hammer, AlertCircle, HardHat, Info, Printer, PieChart as PieChartIcon, Activity,
  ZoomOut, ZoomIn, DollarSign, Percent, LayoutGrid, Truck
} from 'lucide-react';
import { INITIAL_MATERIALS, INITIAL_TOOLS, INITIAL_LABOR_CATEGORIES } from '../constants';
import { Material, Task, Tool, LaborCategory, TaskYield, Crew } from '../types';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const DataAdmin: React.FC = () => {
  const { 
    materials, tasks, tools, laborCategories, rubros, crews, project, yields, toolYields, 
    importData, resetData, updateProjectSettings,
    addMaterial, updateMaterial, removeMaterial,
    addTask, updateTask, removeTask,
    addTool, updateTool, removeTool,
    addLaborCategory, updateLaborCategory, removeLaborCategory,
    addCrew, updateCrew, removeCrew,
    addRubro, removeRubro,
    addTaskYield, removeTaskYield, addTaskToolYield, removeTaskToolYield,
    addTaskCrewYield, removeTaskCrewYield,
    // Indexes
    yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, laborCategoriesMap, taskCrewYieldsIndex, crewsMap
  } = useERP();
  
  const [activeSubTab, setActiveSubTab] = useState<'materials' | 'tasks' | 'tools' | 'labor' | 'rubros' | 'apu' | 'crews'>('materials');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // State for APU Editor Panel
  const [editingAPUTask, setEditingAPUTask] = useState<Task | null>(null);
  const [localTask, setLocalTask] = useState<Task | null>(null); // Draft state for editing
  const [isNewTask, setIsNewTask] = useState(false); // Track if we are creating a fresh task

  const [resourceToAdd, setResourceToAdd] = useState<string>('');
  const [resourceType, setResourceType] = useState<'material' | 'tool' | 'crew'>('material');

  // State for Crew Editor Panel
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [crewMemberToAdd, setCrewMemberToAdd] = useState<string>('');
  const [crewMemberCount, setCrewMemberCount] = useState(1);

  // State for Report
  const [showReport, setShowReport] = useState(false);
  const [reportScale, setReportScale] = useState(1);

  // Smart Import State
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [rawText, setRawText] = useState('');
  const [processingLog, setProcessingLog] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draft states for forms
  const [draftMaterial, setDraftMaterial] = useState<Partial<Material>>({});
  const [draftTask, setDraftTask] = useState<Partial<Task>>({});
  const [draftTool, setDraftTool] = useState<Partial<Tool>>({});
  const [draftLabor, setDraftLabor] = useState<Partial<LaborCategory>>({});
  const [draftRubro, setDraftRubro] = useState<string>('');
  const [draftCrew, setDraftCrew] = useState<Partial<Crew>>({});

  // Sync localTask when editingAPUTask changes (unless it's a new task creation flow handled separately)
  useEffect(() => {
      if (editingAPUTask && !isNewTask) {
          setLocalTask({ ...editingAPUTask });
      }
  }, [editingAPUTask]);

  // --- Report Statistics ---
  const reportStats = useMemo(() => {
      // 1. Integrity Check
      const materialsZeroCost = materials.filter(m => m.cost === 0).length;
      const tasksZeroYield = tasks.filter(t => t.dailyYield === 0).length;
      const tasksWithoutAPU = tasks.filter(t => !yieldsIndex[t.id] && !toolYieldsIndex[t.id] && !taskCrewYieldsIndex[t.id]).length;
      
      // 2. Cost Analysis
      const topMaterials = [...materials].sort((a, b) => b.cost - a.cost).slice(0, 5);
      const avgLaborCost = laborCategories.reduce((acc, curr) => acc + curr.basicHourlyRate, 0) / (laborCategories.length || 1);
      
      // 3. Distribution
      const materialsByCategory = materials.reduce((acc, curr) => {
          const cat = curr.category || 'Otros';
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);
      
      const distributionData = Object.entries(materialsByCategory)
          .map(([name, value]) => ({ name, value }))
          .sort((a,b) => b.value - a.value)
          .slice(0, 5);

      // 4. Labor Cost Chart Data
      const laborChartData = laborCategories.map(l => ({
          name: l.role,
          Costo: (l.basicHourlyRate * (1 + (l.socialChargesPercent + l.insurancePercent)/100))
      })).sort((a,b) => b.Costo - a.Costo);

      return {
          materialsZeroCost,
          tasksZeroYield,
          tasksWithoutAPU,
          topMaterials,
          avgLaborCost,
          distributionData,
          laborChartData,
          totalMaterials: materials.length,
          totalTasks: tasks.length
      };
  }, [materials, tasks, laborCategories, yieldsIndex, toolYieldsIndex, taskCrewYieldsIndex]);

  // --- APU Editor Helpers ---
  const apuAnalysis = useMemo(() => {
    if (!localTask) return null;
    // Calculate using the LOCAL (Draft) task data but Global indexes for relations
    return calculateUnitPrice(localTask, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, taskCrewYieldsIndex, crewsMap, laborCategoriesMap);
  }, [localTask, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, taskCrewYieldsIndex, crewsMap, laborCategoriesMap]);

  const currentAPUMaterials = useMemo(() => {
    if (!localTask) return [];
    return (yieldsIndex[localTask.id] || []).map(y => ({
      ...y,
      data: materialsMap[y.materialId]
    }));
  }, [localTask, yieldsIndex, materialsMap]);

  const currentAPUTools = useMemo(() => {
    if (!localTask) return [];
    return (toolYieldsIndex[localTask.id] || []).map(y => ({
      ...y,
      data: toolsMap[y.toolId]
    }));
  }, [localTask, toolYieldsIndex, toolsMap]);

  // Determine currently assigned crew (if any)
  const currentAPUCrew = useMemo(() => {
      if (!localTask) return null;
      const crewYield = taskCrewYieldsIndex[localTask.id]?.[0]; // Assuming 1 crew per task
      return crewYield ? { ...crewYield, data: crewsMap[crewYield.crewId] } : null;
  }, [localTask, taskCrewYieldsIndex, crewsMap]);

  const handleAddResourceToAPU = () => {
    if (!localTask || !resourceToAdd) return;
    if (resourceType === 'material') {
        addTaskYield({ taskId: localTask.id, materialId: resourceToAdd, quantity: 1 });
    } else if (resourceType === 'tool') {
        addTaskToolYield({ taskId: localTask.id, toolId: resourceToAdd, hoursPerUnit: 1 });
    } else if (resourceType === 'crew') {
        // Remove existing crews first (single crew constraint for simplicity)
        if (currentAPUCrew) {
            removeTaskCrewYield(localTask.id, currentAPUCrew.crewId);
        }
        addTaskCrewYield({ taskId: localTask.id, crewId: resourceToAdd, quantity: 1 });
    }
    setResourceToAdd('');
  };
  
  // --- Create Task Flow ---
  const handleCreateTask = () => {
      const newId = crypto.randomUUID();
      const newTask: Task = {
          id: newId,
          organizationId: 'org_a',
          name: 'Nueva Tarea',
          unit: 'gl',
          laborCost: 0,
          dailyYield: 1,
          category: rubros[0] || 'GENERAL',
          fixedCost: 0,
          fixedCostDescription: ''
      };
      
      // We add it to the global store immediately so relations (yields) can be attached to this ID
      // If user cancels, we remove it.
      addTask(newTask); 
      setEditingAPUTask(newTask);
      setLocalTask({ ...newTask }); 
      setIsNewTask(true);
  };

  const handleSaveTaskChanges = () => {
      if (localTask) {
          updateTask(localTask.id, localTask);
          setEditingAPUTask(null);
          setLocalTask(null);
          setIsNewTask(false);
          setMessage({ type: 'success', text: 'Tarea guardada correctamente.' });
      }
  };

  const handleCancelTaskChanges = () => {
      if (isNewTask && localTask) {
          // If it was a new task and we cancel, we must remove the temp entry from store
          removeTask(localTask.id);
      }
      setEditingAPUTask(null);
      setLocalTask(null);
      setIsNewTask(false);
  };
  // --------------------------

  // --- Crew Editor Helpers ---
  const handleAddMemberToCrew = () => {
      if(!editingCrew || !crewMemberToAdd || crewMemberCount < 1) return;
      
      const newComposition = [...editingCrew.composition];
      const existingIdx = newComposition.findIndex(c => c.laborCategoryId === crewMemberToAdd);
      
      if(existingIdx >= 0) {
          newComposition[existingIdx].count += crewMemberCount;
      } else {
          newComposition.push({ laborCategoryId: crewMemberToAdd, count: crewMemberCount, participation: 100 });
      }
      
      const updatedCrew = { ...editingCrew, composition: newComposition };
      setEditingCrew(updatedCrew);
      updateCrew(editingCrew.id, { composition: newComposition });
      
      setCrewMemberToAdd('');
      setCrewMemberCount(1);
  };

  const updateMemberInCrew = (laborId: string, field: 'count' | 'participation', value: number) => {
      if(!editingCrew) return;
      const newComposition = editingCrew.composition.map(c => {
          if (c.laborCategoryId === laborId) {
              return { ...c, [field]: value };
          }
          return c;
      });
      const updatedCrew = { ...editingCrew, composition: newComposition };
      setEditingCrew(updatedCrew);
      updateCrew(editingCrew.id, { composition: newComposition });
  };

  const removeMemberFromCrew = (laborId: string) => {
      if(!editingCrew) return;
      const newComposition = editingCrew.composition.filter(c => c.laborCategoryId !== laborId);
      const updatedCrew = { ...editingCrew, composition: newComposition };
      setEditingCrew(updatedCrew);
      updateCrew(editingCrew.id, { composition: newComposition });
  };

  const calculateCrewHourlyCost = (crew: Crew) => {
      return crew.composition.reduce((acc, member) => {
          const cat = laborCategoriesMap[member.laborCategoryId];
          if(cat) {
              const hourly = (cat.basicHourlyRate || 0) * (1 + ((cat.socialChargesPercent || 0) + (cat.insurancePercent || 0))/100);
              // Apply participation percentage
              return acc + (hourly * member.count * ((member.participation ?? 100) / 100));
          }
          return acc;
      }, 0);
  };
  // ----------------------------

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (activeSubTab === 'rubros' || activeSubTab === 'apu' || activeSubTab === 'crews') {
        setMessage({ type: 'error', text: 'Importación por archivo JSON no disponible para esta vista.' });
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const result = importData(activeSubTab as any, event.target.result as string);
        if (result.success) {
          setMessage({ type: 'success', text: result.message });
        } else {
          setMessage({ type: 'error', text: result.message });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    let data: any = [];
    if (activeSubTab === 'materials') data = INITIAL_MATERIALS;
    if (activeSubTab === 'tools') data = INITIAL_TOOLS;
    if (activeSubTab === 'tasks') data = [{ id: "new_task", name: "Ejemplo", unit: "m2", laborCost: 10, dailyYield: 10, category: "06 MAMPOSTERÍA" }];
    if (activeSubTab === 'labor') data = INITIAL_LABOR_CATEGORIES;
    if (activeSubTab === 'rubros') data = rubros;
    if (activeSubTab === 'apu') {
        alert("Para APU, utilice 'Copiar y Pegar' desde Excel en el botón de Pegado Inteligente.");
        return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${activeSubTab}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    if (activeSubTab === 'materials') setDraftMaterial(item);
    if (activeSubTab === 'tasks') setDraftTask(item);
    if (activeSubTab === 'tools') setDraftTool(item);
    if (activeSubTab === 'labor') setDraftLabor(item);
    if (activeSubTab === 'crews') setDraftCrew(item);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsAdding(false);
    setDraftMaterial({});
    setDraftTask({});
    setDraftTool({});
    setDraftLabor({});
    setDraftCrew({});
    setDraftRubro('');
  };

  const saveItem = () => {
    if (activeSubTab === 'materials' && draftMaterial) {
      if (isAdding) addMaterial({ ...draftMaterial, id: crypto.randomUUID() } as Material);
      else if (editingId) updateMaterial(editingId, draftMaterial);
    } else if (activeSubTab === 'tasks' && draftTask) {
      if (isAdding) addTask({ ...draftTask, id: crypto.randomUUID() } as Task);
      else if (editingId) updateTask(editingId, draftTask);
    } else if (activeSubTab === 'tools' && draftTool) {
      if (isAdding) addTool({ ...draftTool, id: crypto.randomUUID() } as Tool);
      else if (editingId) updateTool(editingId, draftTool);
    } else if (activeSubTab === 'labor' && draftLabor) {
      if (isAdding) addLaborCategory({ ...draftLabor, id: crypto.randomUUID(), socialChargesPercent: draftLabor.socialChargesPercent || 0, insurancePercent: draftLabor.insurancePercent || 0 } as LaborCategory);
      else if (editingId) updateLaborCategory(editingId, draftLabor);
    } else if (activeSubTab === 'crews' && draftCrew) {
      if (isAdding) addCrew({ ...draftCrew, id: crypto.randomUUID(), composition: [] } as Crew);
      else if (editingId) updateCrew(editingId, draftCrew);
    } else if (activeSubTab === 'rubros' && draftRubro) {
        addRubro(draftRubro.toUpperCase());
    }
    cancelEdit();
  };

  const deleteItem = (id: string) => {
    if (!window.confirm('¿Eliminar este registro permanentemente?')) return;
    if (activeSubTab === 'materials') removeMaterial(id);
    if (activeSubTab === 'tasks') removeTask(id);
    if (activeSubTab === 'tools') removeTool(id);
    if (activeSubTab === 'labor') removeLaborCategory(id);
    if (activeSubTab === 'crews') removeCrew(id);
    if (activeSubTab === 'rubros') removeRubro(id);
  };

  // Helper calculation for labor
  const calculateTotalLabor = (base: number, social: number, insurance: number) => {
    const b = base || 0;
    const s = social || 0;
    const i = insurance || 0;
    return b * (1 + (s + i) / 100);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative flex gap-4">
      
      {/* CSS Injection for Report Printing */}
      <style>{`
        @media print {
          @page { margin: 0.5cm; size: A4; }
          body > *:not(#report-portal) { display: none !important; }
          #report-portal { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999; }
          #report-content { width: 100% !important; transform: none !important; box-shadow: none !important; border: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}</style>

      <div className="flex-1 space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="text-blue-600" /> Base de Datos Maestra
          </h2>
          <p className="text-sm text-slate-500">Gestione los insumos, tareas, equipos y cuadrillas que alimentan sus presupuestos.</p>
        </div>
        <div className="flex gap-2">
          {/* New Report Button */}
          <button 
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <BarChart3 size={16} /> Auditoría BD
          </button>

          <button 
            onClick={() => setShowSmartImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-emerald-200"
          >
            <FileSpreadsheet size={16} /> Importar Excel (APU)
          </button>
          <button 
            onClick={triggerUpload}
            disabled={activeSubTab === 'apu' || activeSubTab === 'rubros' || activeSubTab === 'crews'}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Upload size={16} /> JSON
          </button>
          <button 
            onClick={handleDownloadTemplate}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors"
            title="Descargar Plantilla JSON"
          >
            <FileText size={18} />
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center justify-between gap-2 animate-in slide-in-from-top ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)}><X size={16} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
        <button 
          onClick={() => { setActiveSubTab('materials'); cancelEdit(); setEditingAPUTask(null); setEditingCrew(null); }}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'materials' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Package size={18} /> Insumos
        </button>
        <button 
          onClick={() => { setActiveSubTab('tasks'); cancelEdit(); setEditingAPUTask(null); setEditingCrew(null); }}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'tasks' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <ListChecks size={18} /> Tareas
        </button>
        <button 
          onClick={() => { setActiveSubTab('apu'); cancelEdit(); setEditingAPUTask(null); setEditingCrew(null); }}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'apu' ? 'bg-purple-600 text-white shadow-md shadow-purple-200' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Calculator size={18} /> Análisis (APU)
        </button>
        <button 
          onClick={() => { setActiveSubTab('crews'); cancelEdit(); setEditingAPUTask(null); setEditingCrew(null); }}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'crews' ? 'bg-orange-600 text-white shadow-md shadow-orange-200' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <HardHat size={18} /> Cuadrillas
        </button>
        <button 
          onClick={() => { setActiveSubTab('tools'); cancelEdit(); setEditingAPUTask(null); setEditingCrew(null); }}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'tools' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Wrench size={18} /> Equipos
        </button>
        <button 
          onClick={() => { setActiveSubTab('labor'); cancelEdit(); setEditingAPUTask(null); setEditingCrew(null); }}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'labor' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Users size={18} /> Mano de Obra
        </button>
        <button 
          onClick={() => { setActiveSubTab('rubros'); cancelEdit(); setEditingAPUTask(null); setEditingCrew(null); }}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'rubros' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Tags size={18} /> Rubros
        </button>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />

      {/* Main Table Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            {activeSubTab === 'materials' && `Catálogo de Materiales (${materials.length})`}
            {activeSubTab === 'tasks' && `Listado de Tareas (${tasks.length})`}
            {activeSubTab === 'apu' && `Análisis de Precios Unitarios (${tasks.length})`}
            {activeSubTab === 'tools' && `Equipos Disponibles (${tools.length})`}
            {activeSubTab === 'labor' && `Categorías de Operarios (${laborCategories.length})`}
            {activeSubTab === 'crews' && `Configuración de Cuadrillas (${crews.length})`}
            {activeSubTab === 'rubros' && `Rubros Configurados (${rubros.length})`}
          </h3>
          {activeSubTab !== 'apu' && (
            <button 
                onClick={() => { 
                    if(activeSubTab === 'tasks') {
                        handleCreateTask(); // Create and open full editor
                    } else {
                        setIsAdding(true); 
                        setEditingId(null); 
                    }
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
                <Plus size={14} /> Nuevo {activeSubTab === 'materials' ? 'Insumo' : activeSubTab === 'crews' ? 'Cuadrilla' : activeSubTab === 'tasks' ? 'Tarea' : activeSubTab === 'labor' ? 'Rol' : activeSubTab === 'rubros' ? 'Rubro' : 'Equipo'}
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500">{activeSubTab === 'labor' || activeSubTab === 'rubros' ? 'Nombre / Descripción' : 'Nombre / Identificador'}</th>
                
                {activeSubTab !== 'labor' && activeSubTab !== 'rubros' && activeSubTab !== 'crews' && <th className="p-4 text-xs font-semibold text-slate-500">Categoría</th>}
                
                {/* APU SPECIFIC HEADERS */}
                {activeSubTab === 'apu' && (
                    <>
                        <th className="p-4 text-xs font-semibold text-slate-500 text-right">Materiales</th>
                        <th className="p-4 text-xs font-semibold text-slate-500 text-right">Mano Obra</th>
                        <th className="p-4 text-xs font-semibold text-slate-500 text-right">Equipos</th>
                    </>
                )}

                {activeSubTab === 'crews' && <th className="p-4 text-xs font-semibold text-slate-500">Composición</th>}

                {activeSubTab === 'materials' && <th className="p-4 text-xs font-semibold text-slate-500">Unidad</th>}
                {activeSubTab === 'labor' && <th className="p-4 text-xs font-semibold text-slate-500 text-right">Valor Básico/Hora</th>}
                {activeSubTab === 'labor' && <th className="p-4 text-xs font-semibold text-slate-500 text-right">Cargas Soc. (%)</th>}
                {activeSubTab === 'labor' && <th className="p-4 text-xs font-semibold text-slate-500 text-right">Aportes/Seg. (%)</th>}
                
                {activeSubTab !== 'rubros' && (
                    <th className="p-4 text-xs font-semibold text-slate-500 text-right">
                    {activeSubTab === 'materials' ? 'Costo Unit.' : activeSubTab === 'tasks' ? 'Costo MO Est.' : activeSubTab === 'crews' ? 'Costo Hora (Est.)' : activeSubTab === 'labor' ? 'COSTO FINAL' : activeSubTab === 'apu' ? 'TOTAL APU' : 'Costo x Hora'}
                    </th>
                )}
                <th className="p-4 text-xs font-semibold text-slate-500 text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Add New Row Inline */}
              {isAdding && activeSubTab !== 'apu' && activeSubTab !== 'tasks' && (
                <tr className="bg-blue-50/50">
                  <td className="p-3">
                    <input 
                      className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500" 
                      placeholder={activeSubTab === 'labor' ? "Ej: Oficial Especializado" : activeSubTab === 'crews' ? "Ej: Cuadrilla Hormigón" : activeSubTab === 'rubros' ? "Ej: 99 NUEVO RUBRO" : "Nombre..."}
                      autoFocus
                      onChange={e => {
                          const val = e.target.value;
                          if (activeSubTab === 'materials') setDraftMaterial({...draftMaterial, name: val});
                          else if (activeSubTab === 'tools') setDraftTool({...draftTool, name: val});
                          else if (activeSubTab === 'labor') setDraftLabor({...draftLabor, role: val});
                          else if (activeSubTab === 'crews') setDraftCrew({...draftCrew, name: val});
                          else if (activeSubTab === 'rubros') setDraftRubro(val);
                      }}
                    />
                  </td>
                  {/* ... Existing input cells logic ... */}
                  {activeSubTab === 'crews' && (
                      <td className="p-3">
                          <input className="w-full p-2 text-sm border rounded" placeholder="Descripción opcional" onChange={e => setDraftCrew({...draftCrew, description: e.target.value})}/>
                      </td>
                  )}
                  {/* ... other tabs inputs ... */}
                  
                  {/* Save buttons */}
                  <td className="p-3 flex justify-center gap-1">
                    <button onClick={saveItem} className="p-2 text-green-600 hover:bg-green-100 rounded"><Save size={16} /></button>
                    <button onClick={cancelEdit} className="p-2 text-slate-400 hover:bg-slate-100 rounded"><X size={16} /></button>
                  </td>
                </tr>
              )}

              {/* Data Rows */}
              {(activeSubTab === 'materials' ? materials : activeSubTab === 'tasks' || activeSubTab === 'apu' ? tasks : activeSubTab === 'tools' ? tools : activeSubTab === 'labor' ? laborCategories : activeSubTab === 'crews' ? crews : rubros).map((item: any) => {
                const itemId = activeSubTab === 'rubros' ? item : item.id;
                const displayName = activeSubTab === 'rubros' ? item : activeSubTab === 'labor' ? item.role : item.name;
                const isEditingAPU = editingAPUTask?.id === item.id;
                const isEditingCrew = editingCrew?.id === item.id;
                
                // Calculate APU if needed
                let apu = null;
                if (activeSubTab === 'apu') {
                    apu = calculateUnitPrice(item, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, taskCrewYieldsIndex, crewsMap, laborCategoriesMap);
                }

                return (
                <tr key={itemId} className={`hover:bg-slate-50 group ${editingId === itemId || isEditingAPU || isEditingCrew ? 'bg-blue-50' : ''}`}>
                  <td className="p-4">
                    {editingId === itemId && activeSubTab !== 'rubros' && activeSubTab !== 'apu' ? (
                      <input 
                        className="w-full p-1 text-sm border rounded" 
                        value={activeSubTab === 'labor' ? draftLabor.role : activeSubTab === 'crews' ? draftCrew.name : item.name}
                        onChange={e => {
                            const val = e.target.value;
                            if (activeSubTab === 'materials') setDraftMaterial({...draftMaterial, name: val});
                            else if (activeSubTab === 'tools') setDraftTool({...draftTool, name: val});
                            else if (activeSubTab === 'labor') setDraftLabor({...draftLabor, role: val});
                            else if (activeSubTab === 'crews') setDraftCrew({...draftCrew, name: val});
                        }}
                      />
                    ) : (
                      <div>
                          <div className="font-medium text-slate-800">{displayName}</div>
                          {activeSubTab === 'crews' && item.description && <div className="text-[10px] text-slate-400">{item.description}</div>}
                          {activeSubTab === 'apu' && (
                             <div className="text-[10px] text-slate-400">Rend: {item.dailyYield} u/d • {item.unit}</div>
                          )}
                      </div>
                    )}
                    {(activeSubTab !== 'rubros' && activeSubTab !== 'apu') && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{itemId.substring(0, 12)}</div>}
                  </td>

                  {activeSubTab !== 'labor' && activeSubTab !== 'rubros' && activeSubTab !== 'crews' && (
                    <td className="p-4">
                        {editingId === itemId ? (
                            <input className="w-full p-1 text-sm border rounded" value={activeSubTab === 'materials' ? draftMaterial.category : draftTool.category} onChange={e => activeSubTab === 'materials' ? setDraftMaterial({...draftMaterial, category: e.target.value}) : setDraftTool({...draftTool, category: e.target.value})} />
                        ) : (
                        <span className="text-xs text-slate-500 font-medium px-2 py-0.5 bg-slate-100 rounded border border-slate-200">{item.category || 'S/C'}</span>
                        )}
                    </td>
                  )}

                  {/* Crew Composition Cell */}
                  {activeSubTab === 'crews' && (
                      <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                              {item.composition?.map((c: any, i: number) => {
                                  const cat = laborCategoriesMap[c.laborCategoryId];
                                  return (
                                      <span key={i} className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">
                                          {c.count}x {cat?.role || '?'} {(c.participation && c.participation < 100) ? `(${c.participation}%)` : ''}
                                      </span>
                                  )
                              })}
                              {(!item.composition || item.composition.length === 0) && <span className="text-xs text-slate-400 italic">Sin integrantes</span>}
                          </div>
                      </td>
                  )}

                  {/* APU BREAKDOWN COLUMNS */}
                  {activeSubTab === 'apu' && apu && (
                      <>
                        <td className="p-4 text-right text-xs text-slate-600">${apu.materialCost.toFixed(2)}</td>
                        <td className="p-4 text-right text-xs text-slate-600">${apu.laborCost.toFixed(2)}</td>
                        <td className="p-4 text-right text-xs text-slate-600">${apu.toolCost.toFixed(2)}</td>
                      </>
                  )}

                  {/* Labor Columns Editable */}
                  {activeSubTab === 'labor' && (
                      <>
                        <td className="p-4 text-right">
                             {editingId === itemId ? <input type="number" className="w-20 p-1 text-sm text-right border rounded" value={draftLabor.basicHourlyRate} onChange={e => setDraftLabor({...draftLabor, basicHourlyRate: parseFloat(e.target.value)})} /> : <span className="text-slate-600">${item.basicHourlyRate?.toFixed(2)}</span>}
                        </td>
                        <td className="p-4 text-right">
                             {editingId === itemId ? <input type="number" className="w-16 p-1 text-sm text-right border rounded" value={draftLabor.socialChargesPercent} onChange={e => setDraftLabor({...draftLabor, socialChargesPercent: parseFloat(e.target.value)})} /> : <span className="text-slate-500">{item.socialChargesPercent}%</span>}
                        </td>
                        <td className="p-4 text-right">
                             {editingId === itemId ? <input type="number" className="w-16 p-1 text-sm text-right border rounded" value={draftLabor.insurancePercent} onChange={e => setDraftLabor({...draftLabor, insurancePercent: parseFloat(e.target.value)})} /> : <span className="text-slate-500">{item.insurancePercent}%</span>}
                        </td>
                      </>
                  )}

                  {activeSubTab !== 'rubros' && (
                    <td className="p-4 text-right">
                        {editingId === itemId && activeSubTab !== 'labor' && activeSubTab !== 'apu' && activeSubTab !== 'crews' ? (
                        <input 
                            type="number" className="w-24 p-1 text-sm border rounded text-right" 
                            value={activeSubTab === 'materials' ? draftMaterial.cost : draftTool.costPerHour}
                            onChange={e => {
                            const val = parseFloat(e.target.value);
                            if(activeSubTab === 'materials') setDraftMaterial({...draftMaterial, cost: val});
                            else setDraftTool({...draftTool, costPerHour: val});
                            }}
                        />
                        ) : (
                        <span className={`font-mono font-bold ${activeSubTab === 'apu' ? 'text-purple-700' : 'text-slate-700'}`}>
                            {activeSubTab === 'labor' 
                            ? `$${calculateTotalLabor(
                                    editingId === itemId ? draftLabor.basicHourlyRate! : item.basicHourlyRate,
                                    editingId === itemId ? draftLabor.socialChargesPercent! : item.socialChargesPercent,
                                    editingId === itemId ? draftLabor.insurancePercent! : item.insurancePercent
                                ).toFixed(2)}`
                            : activeSubTab === 'apu'
                                ? `$${(apu?.totalUnitCost || 0).toFixed(2)}`
                                : activeSubTab === 'crews'
                                    ? `$${calculateCrewHourlyCost(item).toFixed(2)}`
                                    : `$${(activeSubTab === 'materials' ? (item.cost || 0) : activeSubTab === 'tasks' ? (item.laborCost || 0) : (item.costPerHour || 0)).toFixed(2)}`
                            }
                        </span>
                        )}
                        {(activeSubTab === 'labor' || activeSubTab === 'crews' || activeSubTab === 'tools') && <div className="text-[10px] text-slate-400 uppercase font-bold">Total Hora</div>}
                    </td>
                  )}
                  
                  <td className="p-4 text-center">
                      <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingId === itemId ? (
                          <>
                          <button onClick={saveItem} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Guardar"><Save size={14} /></button>
                          <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded" title="Cancelar"><X size={14} /></button>
                          </>
                      ) : (
                          <>
                           {/* Botón de edición de APU / Tarea */}
                           {(activeSubTab === 'apu' || activeSubTab === 'tasks') && (
                               <button 
                                 onClick={() => { setEditingAPUTask(item); setLocalTask({...item}); setIsNewTask(false); }}
                                 className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" 
                                 title="Configurar APU y Rendimientos"
                               >
                                  <Settings size={16} />
                               </button>
                           )}
                           
                           {/* Botón de edición de Cuadrilla */}
                           {activeSubTab === 'crews' && (
                               <button 
                                 onClick={() => setEditingCrew(item)}
                                 className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" 
                                 title="Configurar Composición"
                               >
                                  <Users size={16} />
                               </button>
                           )}

                           {(activeSubTab !== 'rubros' && activeSubTab !== 'apu' && activeSubTab !== 'crews' && activeSubTab !== 'tasks') && <button onClick={() => startEdit(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Editar"><Edit2 size={14} /></button>}
                           <button onClick={() => deleteItem(itemId)} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Eliminar"><Trash2 size={14} /></button>
                          </>
                      )}
                      </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      </div>

      {/* --- APU EDITOR SIDE PANEL --- */}
      {editingAPUTask && localTask && apuAnalysis && (
          <aside className="w-[480px] flex-shrink-0 bg-white border-l border-slate-200 shadow-2xl flex flex-col h-[calc(100vh-80px)] sticky top-0 rounded-l-xl animate-in slide-in-from-right z-20">
             {/* Header with Basic Info Editing */}
             <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
                <div className="w-full pr-4">
                    <span className="text-[10px] font-bold uppercase text-purple-600 tracking-wider">Editor de Tarea y APU</span>
                    
                    {/* Basic Info Inputs (Binding to localTask) */}
                    <div className="mt-2 space-y-2">
                        <input 
                            className="w-full text-lg font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-400 focus:border-purple-600 focus:outline-none pb-1"
                            value={localTask.name}
                            onChange={e => setLocalTask({...localTask, name: e.target.value })}
                            placeholder="Nombre de la Tarea"
                        />
                        <div className="flex gap-2">
                            <input 
                                className="w-20 text-xs font-bold text-slate-500 bg-white border border-slate-300 rounded px-2 py-1 focus:border-purple-500 outline-none"
                                value={localTask.unit}
                                onChange={e => setLocalTask({...localTask, unit: e.target.value })}
                                placeholder="Unidad"
                            />
                            <select 
                                className="flex-1 text-xs text-slate-500 bg-white border border-slate-300 rounded px-2 py-1 focus:border-purple-500 outline-none"
                                value={localTask.category || ''}
                                onChange={e => setLocalTask({...localTask, category: e.target.value })}
                            >
                                <option value="">-- Categoría --</option>
                                {rubros.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <button onClick={handleCancelTaskChanges} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors flex-shrink-0">
                    <X size={20} />
                </button>
             </div>
             {/* Content */}
             <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* 1. Rendimiento General */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 pb-2 border-b border-slate-100 justify-between">
                        <span className="flex items-center gap-2"><Hammer size={14} className="text-orange-500" /> Mano de Obra y Cuadrillas</span>
                        <span className="text-orange-600 font-mono">${apuAnalysis.laborCost.toFixed(2)}/u</span>
                    </h4>
                    
                    {/* Toggle: Manual vs Crew */}
                    <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-bold text-slate-500 mb-2">
                        <div className={`flex-1 py-1.5 text-center rounded cursor-default ${!currentAPUCrew ? 'bg-white shadow text-slate-800' : ''}`}>Costo Manual</div>
                        <div className={`flex-1 py-1.5 text-center rounded cursor-default ${currentAPUCrew ? 'bg-white shadow text-orange-600' : ''}`}>Basado en Cuadrilla</div>
                    </div>

                    {currentAPUCrew ? (
                        <div className="space-y-3">
                            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 relative group">
                                <button onClick={() => removeTaskCrewYield(localTask.id, currentAPUCrew.crewId)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><X size={14}/></button>
                                <div className="font-bold text-slate-800 text-sm">{currentAPUCrew.data?.name}</div>
                                <div className="text-xs text-slate-500 mt-1 mb-2">{currentAPUCrew.data?.description}</div>
                                
                                <div className="flex justify-between items-center text-[10px] text-slate-500 bg-white p-2 rounded border border-orange-100">
                                    <span>Costo Diario Cuadrilla:</span>
                                    <span className="font-mono font-bold text-slate-700">${(calculateCrewHourlyCost(currentAPUCrew.data!) * (project.workdayHours || 9)).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Yield Override for this Task */}
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <label className="block text-[10px] font-bold text-blue-800 mb-2 uppercase">Rendimiento de Tarea (Define Costo Unit.)</label>
                                <div className="flex items-center gap-2 mb-2">
                                    <input 
                                        type="number" 
                                        className="w-full text-sm p-2 border border-blue-200 rounded text-center font-bold text-blue-700"
                                        value={localTask.dailyYield}
                                        onChange={(e) => setLocalTask({...localTask, dailyYield: parseFloat(e.target.value) })}
                                    />
                                    <span className="text-xs text-blue-500 font-bold whitespace-nowrap">{localTask.unit}/día</span>
                                </div>
                                <p className="text-[10px] text-blue-400 italic">
                                    Formula: (Costo Diario Cuadrilla) / Rendimiento = Costo Unitario
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center bg-white p-2 border border-slate-200 rounded">
                                <span className="text-xs font-medium text-slate-600">Costo Directo por Unidad</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400 text-xs">$</span>
                                    <input 
                                        type="number" 
                                        className="w-20 text-right text-sm font-bold text-slate-700 outline-none"
                                        value={localTask.laborCost}
                                        onChange={(e) => setLocalTask({...localTask, laborCost: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 italic px-1">
                                <Info size={10} className="inline mr-1"/>
                                Defina un costo fijo manual si no utiliza análisis de cuadrillas.
                            </p>
                        </div>
                    )}
                </div>

                {/* 3. Materials Config (Renamed Yield) */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 pb-2 border-b border-slate-100 justify-between">
                        <span className="flex items-center gap-2"><Package size={14} className="text-blue-500" /> Materiales</span>
                        <span className="text-blue-600 font-mono">${apuAnalysis.materialCost.toFixed(2)}/u</span>
                    </h4>
                    <div className="space-y-2">
                        {currentAPUMaterials.length === 0 && <div className="text-xs text-slate-400 italic">No consume materiales.</div>}
                        {currentAPUMaterials.map(item => (
                            <div key={item.materialId} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-slate-700 truncate w-40" title={item.data?.name}>{item.data?.name}</div>
                                    <div className="text-[10px] text-slate-400">{item.data?.unit} • ${item.data?.cost}</div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Consumo Std.</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number"
                                            className="w-14 text-right p-1 text-xs border border-slate-300 rounded bg-white font-bold"
                                            value={item.quantity}
                                            onChange={(e) => addTaskYield({ taskId: localTask.id, materialId: item.materialId, quantity: parseFloat(e.target.value) })}
                                        />
                                        <button onClick={() => removeTaskYield(localTask.id, item.materialId)} className="text-slate-400 hover:text-red-500 p-1"><X size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. Tools Config (Renamed Yield) */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 pb-2 border-b border-slate-100 justify-between">
                        <span className="flex items-center gap-2"><Wrench size={14} className="text-purple-500" /> Equipos</span>
                        <span className="text-purple-600 font-mono">${apuAnalysis.toolCost.toFixed(2)}/u</span>
                    </h4>
                    <div className="space-y-2">
                        {currentAPUTools.length === 0 && <div className="text-xs text-slate-400 italic">No requiere equipos.</div>}
                        {currentAPUTools.map(item => (
                            <div key={item.toolId} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <div className="flex-1">
                                    <div className="text-xs font-bold text-slate-700 truncate w-40" title={item.data?.name}>{item.data?.name}</div>
                                    <div className="text-[10px] text-slate-400">Tarifa: ${item.data?.costPerHour}/h</div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Hs x Unidad</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number"
                                            className="w-14 text-right p-1 text-xs border border-slate-300 rounded bg-white font-bold"
                                            value={item.hoursPerUnit}
                                            onChange={(e) => addTaskToolYield({ taskId: localTask.id, toolId: item.toolId, hoursPerUnit: parseFloat(e.target.value) })}
                                        />
                                        <button onClick={() => removeTaskToolYield(localTask.id, item.toolId)} className="text-slate-400 hover:text-red-500 p-1"><X size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Fixed Costs / Ayuda Gremio / Flete */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 pb-2 border-b border-slate-100 justify-between">
                        <span className="flex items-center gap-2"><Truck size={14} className="text-emerald-500" /> Costos Fijos / Adicionales</span>
                        <span className="text-emerald-600 font-mono">${(localTask.fixedCost || 0).toFixed(2)}/u</span>
                    </h4>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-2">
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Descripción del Costo (Ej: Flete, Ayuda Gremio)</label>
                            <input 
                                type="text"
                                placeholder="Ej: Flete o Adicional Gremio"
                                className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                                value={localTask.fixedCostDescription || ''}
                                onChange={(e) => setLocalTask({...localTask, fixedCostDescription: e.target.value })}
                            />
                        </div>
                        <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                            <span className="text-xs font-medium text-slate-600">Valor Adicional por Unidad</span>
                            <div className="flex items-center gap-1">
                                <span className="text-slate-400 text-xs">$</span>
                                <input 
                                    type="number" 
                                    className="w-20 text-right text-sm font-bold text-slate-700 outline-none"
                                    value={localTask.fixedCost || 0}
                                    onChange={(e) => setLocalTask({...localTask, fixedCost: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add Resource Form */}
                <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase">Agregar Recurso al Estándar</label>
                    <div className="flex gap-1 mb-2">
                        <button onClick={() => setResourceType('material')} className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${resourceType === 'material' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>Material</button>
                        <button onClick={() => setResourceType('tool')} className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${resourceType === 'tool' ? 'bg-white shadow text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}>Equipo</button>
                        <button onClick={() => setResourceType('crew')} className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${resourceType === 'crew' ? 'bg-white shadow text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}>Cuadrilla</button>
                    </div>
                    <div className="flex gap-2">
                        <select className="flex-1 text-xs p-2 border border-slate-300 rounded bg-white focus:outline-none" value={resourceToAdd} onChange={(e) => setResourceToAdd(e.target.value)}>
                            <option value="">-- Seleccionar --</option>
                            {resourceType === 'material' 
                                ? materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                                : resourceType === 'tool'
                                    ? tools.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                                    : crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                            }
                        </select>
                        <button onClick={handleAddResourceToAPU} disabled={!resourceToAdd} className="bg-slate-800 text-white p-2 rounded hover:bg-black disabled:opacity-50"><Plus size={16} /></button>
                    </div>
                </div>
             </div>

             {/* Footer Actions */}
             <div className="p-5 border-t border-slate-200 bg-slate-50 flex gap-3">
                 <button 
                    onClick={handleCancelTaskChanges}
                    className="flex-1 bg-white border border-slate-300 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-100 transition-all flex justify-center items-center gap-2"
                 >
                    <X size={18} /> Cancelar
                 </button>
                 <button 
                    onClick={handleSaveTaskChanges}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2"
                 >
                    <Save size={18} /> {isNewTask ? 'Crear Tarea' : 'Guardar Cambios'}
                 </button>
             </div>
          </aside>
      )}

      {/* --- CREW EDITOR SIDE PANEL --- */}
      {editingCrew && (
          <aside className="w-[550px] flex-shrink-0 bg-white border-l border-slate-200 shadow-2xl flex flex-col h-[calc(100vh-80px)] sticky top-0 rounded-l-xl animate-in slide-in-from-right z-20">
             {/* Header */}
             <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-start">
                <div>
                    <span className="text-[10px] font-bold uppercase text-orange-600 tracking-wider">Configuración de Cuadrilla</span>
                    <h3 className="font-bold text-lg text-slate-800 leading-tight mt-1">{editingCrew.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{editingCrew.description || 'Sin descripción'}</p>
                </div>
                <button onClick={() => setEditingCrew(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                    <X size={20} />
                </button>
             </div>

             <div className="flex-1 overflow-y-auto p-5 space-y-6">
                 
                 <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl text-center">
                     <p className="text-xs font-bold text-orange-800 uppercase mb-1">Costo Hora Estimado (Total)</p>
                     <p className="text-3xl font-mono font-bold text-orange-600">${calculateCrewHourlyCost(editingCrew).toFixed(2)}</p>
                     <p className="text-[10px] text-orange-400 mt-1">(Suma de Valor Hora + Cargas Sociales ajustado por participación)</p>
                 </div>

                 {/* Composition List */}
                 <div>
                     <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 pb-2 border-b border-slate-100 mb-3">
                        <Users size={14} className="text-orange-500" /> Integrantes y Participación
                     </h4>
                     
                     <div className="space-y-2">
                         {editingCrew.composition.length === 0 && <div className="text-xs text-slate-400 italic">No hay operarios asignados.</div>}
                         
                         {editingCrew.composition.length > 0 && (
                             <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase px-2 mb-1">
                                 <div className="col-span-5">Rol</div>
                                 <div className="col-span-2 text-center">Cant.</div>
                                 <div className="col-span-2 text-center">% Part.</div>
                                 <div className="col-span-3 text-right">Subtotal</div>
                             </div>
                         )}

                         {editingCrew.composition.map((c, i) => {
                             const cat = laborCategoriesMap[c.laborCategoryId];
                             const totalHourly = cat ? calculateTotalLabor(cat.basicHourlyRate, cat.socialChargesPercent, cat.insurancePercent) : 0;
                             const subtotal = totalHourly * c.count * ((c.participation ?? 100) / 100);

                             return (
                                 <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200 text-sm group">
                                     <div className="col-span-5 font-medium text-slate-700 truncate" title={cat?.role}>
                                         {cat?.role}
                                     </div>
                                     <div className="col-span-2 text-center">
                                         <input 
                                            type="number" min="1" step="0.5"
                                            className="w-full text-center bg-white border border-slate-300 rounded py-1 text-xs"
                                            value={c.count}
                                            onChange={e => updateMemberInCrew(c.laborCategoryId, 'count', parseFloat(e.target.value))}
                                         />
                                     </div>
                                     <div className="col-span-2 text-center">
                                         <input 
                                            type="number" min="0" max="100"
                                            className="w-full text-center bg-white border border-slate-300 rounded py-1 text-xs"
                                            value={c.participation ?? 100}
                                            onChange={e => updateMemberInCrew(c.laborCategoryId, 'participation', parseFloat(e.target.value))}
                                         />
                                     </div>
                                     <div className="col-span-3 flex items-center justify-end gap-2">
                                         <span className="font-mono font-bold text-slate-600 text-xs">${subtotal.toFixed(2)}</span>
                                         <button onClick={() => removeMemberFromCrew(c.laborCategoryId)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                     </div>
                                 </div>
                             )
                         })}
                     </div>
                 </div>

                 {/* Add Member Form */}
                 <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-500 mb-2 block uppercase">Agregar Recurso</label>
                    <div className="flex gap-2">
                        <select 
                           className="flex-1 text-xs p-2 border border-slate-300 rounded bg-white focus:outline-none"
                           value={crewMemberToAdd}
                           onChange={(e) => setCrewMemberToAdd(e.target.value)}
                        >
                            <option value="">-- Seleccionar Rol --</option>
                            {laborCategories.map(lc => <option key={lc.id} value={lc.id}>{lc.role}</option>)}
                        </select>
                        <button onClick={handleAddMemberToCrew} disabled={!crewMemberToAdd} className="bg-slate-800 text-white p-2 rounded hover:bg-black disabled:opacity-50"><Plus size={16} /></button>
                    </div>
                 </div>

             </div>
          </aside>
      )}

    </div>
  );
};