
import React, { createContext, useContext, useMemo, ReactNode, useEffect } from 'react';
import { Material, Task, TaskYield, TaskToolYield, Tool, Project, BudgetItem, ImportResult, LaborCategory, ProjectTemplate, Snapshot, Reception, Subcontractor, Contract, Certification, CalendarPreset, ProjectDocument, MeasurementSheet, Crew, TaskCrewYield, QualityProtocol, QualityInspection, NonConformity } from '../types';
import { INITIAL_MATERIALS, INITIAL_TASKS, INITIAL_YIELDS, INITIAL_PROJECT, INITIAL_TOOLS, INITIAL_TOOL_YIELDS, INITIAL_LABOR_CATEGORIES, INITIAL_RUBROS, INITIAL_CALENDAR_PRESETS, INITIAL_CREWS, INITIAL_CREW_YIELDS, INITIAL_QUALITY_PROTOCOLS } from '../constants';
import { useAuth } from './AuthContext';
import { usePersistentState } from '../hooks/usePersistentState';

interface MaterialStockStatus {
    material: Material;
    budgeted: number; 
    received: number; 
    pending: number; 
}

interface ERPContextType {
  // Data Lists (Filtered by Org)
  materials: Material[];
  tasks: Task[];
  yields: TaskYield[];
  tools: Tool[];
  toolYields: TaskToolYield[];
  laborCategories: LaborCategory[];
  rubros: string[];
  crews: Crew[];
  taskCrewYields: TaskCrewYield[];
  
  // Project Management
  project: Project; // The Active Project
  projects: Project[]; // All Projects for Org
  activeProjectId: string | null;
  createNewProject: (data: Partial<Project>) => void;
  setActiveProject: (id: string) => void;
  exitProject: () => void; // NEW: Go back to Hub
  deleteProject: (id: string) => void;
  saveProject: () => Promise<void>; 

  snapshots: Snapshot[];
  receptions: Reception[];
  subcontractors: Subcontractor[];
  contracts: Contract[];
  certifications: Certification[];
  calendarPresets: CalendarPreset[];
  documents: ProjectDocument[];
  measurementSheets: MeasurementSheet[];
  
  // Quality Management
  qualityProtocols: QualityProtocol[];
  qualityInspections: QualityInspection[];
  nonConformities: NonConformity[];

  // Optimization Indexes (For O(1) Lookups)
  materialsMap: Record<string, Material>;
  tasksMap: Record<string, Task>;
  toolsMap: Record<string, Tool>;
  laborCategoriesMap: Record<string, LaborCategory>;
  crewsMap: Record<string, Crew>;
  yieldsIndex: Record<string, TaskYield[]>; 
  toolYieldsIndex: Record<string, TaskToolYield[]>; 
  taskCrewYieldsIndex: Record<string, TaskCrewYield[]>; 
  
  // Actions
  addMaterial: (m: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  removeMaterial: (id: string) => void;
  
  addTask: (t: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateTaskMaster: (taskId: string, updates: Partial<Task>) => void; // NEW: Master Sync Function
  removeTask: (id: string) => void;
  
  addTool: (t: Tool) => void;
  updateTool: (id: string, updates: Partial<Tool>) => void;
  removeTool: (id: string) => void;

  addLaborCategory: (lc: LaborCategory) => void;
  updateLaborCategory: (id: string, updates: Partial<LaborCategory>) => void;
  removeLaborCategory: (id: string) => void;

  addCrew: (c: Crew) => void;
  updateCrew: (id: string, updates: Partial<Crew>) => void;
  removeCrew: (id: string) => void;

  addRubro: (name: string) => void;
  removeRubro: (name: string) => void;

  updateProjectSettings: (p: Partial<Project>) => void;
  addBudgetItem: (item: BudgetItem) => void;
  removeBudgetItem: (itemId: string) => void;
  updateBudgetItem: (itemId: string, updates: Partial<BudgetItem>) => void;
  
  // Resource Actions
  addTaskYield: (yieldData: TaskYield) => void;
  removeTaskYield: (taskId: string, materialId: string) => void;
  addTaskToolYield: (toolYieldData: TaskToolYield) => void;
  removeTaskToolYield: (taskId: string, toolId: string) => void;
  addTaskCrewYield: (crewYieldData: TaskCrewYield) => void;
  removeTaskCrewYield: (taskId: string, crewId: string) => void;
  
  loadTemplate: (template: ProjectTemplate) => void;
  importData: (type: 'materials' | 'tasks' | 'tools' | 'labor', jsonData: string) => ImportResult;
  createSnapshot: (name: string, totalCost: number) => void;
  resetData: () => void;

  // Database Management
  exportDatabase: () => string;
  importDatabase: (json: string) => ImportResult;

  addReception: (reception: Reception) => void;
  getProjectStockStatus: () => MaterialStockStatus[];

  addSubcontractor: (s: Subcontractor) => void;
  updateSubcontractor: (id: string, updates: Partial<Subcontractor>) => void;
  addContract: (c: Contract) => void;
  addCertification: (c: Certification) => void;

  // Calendar
  addCalendarPreset: (preset: CalendarPreset) => void;
  applyCalendarPreset: (presetId: string) => void;

  // Documents & Measurements
  addDocument: (doc: ProjectDocument) => void;
  removeDocument: (id: string) => void;
  saveMeasurementSheet: (sheet: MeasurementSheet) => void;
  syncMeasurementToBudget: (sheetId: string) => void; 

  // Quality Actions
  addQualityProtocol: (p: QualityProtocol) => void;
  updateQualityProtocol: (id: string, updates: Partial<QualityProtocol>) => void;
  addQualityInspection: (i: QualityInspection) => void;
  addNonConformity: (n: NonConformity) => void;
  updateNonConformity: (id: string, updates: Partial<NonConformity>) => void;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

export const ERPProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const orgId = user?.organizationId || 'public'; 

  // --- RAW DATA (Managed via custom hook for persistence) ---
  const migrate = (data: any[]) => data.map((d: any) => ({...d, organizationId: d.organizationId || 'org_a'}));

  const [allMaterials, setAllMaterials] = usePersistentState<Material[]>('erp_materials', migrate(INITIAL_MATERIALS));
  const [allTasks, setAllTasks] = usePersistentState<Task[]>('erp_tasks', migrate(INITIAL_TASKS));
  const [allTools, setAllTools] = usePersistentState<Tool[]>('erp_tools', migrate(INITIAL_TOOLS));
  const [allLaborCategories, setAllLaborCategories] = usePersistentState<LaborCategory[]>('erp_labor_categories', migrate(INITIAL_LABOR_CATEGORIES));
  const [allCrews, setAllCrews] = usePersistentState<Crew[]>('erp_crews', migrate(INITIAL_CREWS));
  const [allProjects, setAllProjects] = usePersistentState<Project[]>('erp_projects', migrate([INITIAL_PROJECT]));
  const [activeProjectId, setActiveProjectId] = usePersistentState<string | null>('erp_active_project_id', null);

  const [allSnapshots, setAllSnapshots] = usePersistentState<Snapshot[]>('erp_snapshots', []);
  const [allReceptions, setAllReceptions] = usePersistentState<Reception[]>('erp_receptions', []);
  const [allSubcontractors, setAllSubcontractors] = usePersistentState<Subcontractor[]>('erp_subcontractors', []);
  const [allContracts, setAllContracts] = usePersistentState<Contract[]>('erp_contracts', []);
  const [allCertifications, setAllCertifications] = usePersistentState<Certification[]>('erp_certifications', []);
  
  // Shared/Global Data
  const [yields, setYields] = usePersistentState<TaskYield[]>('erp_yields', INITIAL_YIELDS);
  const [toolYields, setToolYields] = usePersistentState<TaskToolYield[]>('erp_tool_yields', INITIAL_TOOL_YIELDS);
  const [taskCrewYields, setTaskCrewYields] = usePersistentState<TaskCrewYield[]>('erp_crew_yields', INITIAL_CREW_YIELDS);
  const [rubros, setRubros] = usePersistentState<string[]>('erp_rubros', INITIAL_RUBROS);
  const [calendarPresets, setCalendarPresets] = usePersistentState<CalendarPreset[]>('erp_calendar_presets', INITIAL_CALENDAR_PRESETS);
  
  // New Tables Data
  const [allDocuments, setAllDocuments] = usePersistentState<ProjectDocument[]>('erp_documents', []);
  const [allMeasurementSheets, setAllMeasurementSheets] = usePersistentState<MeasurementSheet[]>('erp_measurements', []);

  // Quality Data
  const [allQualityProtocols, setAllQualityProtocols] = usePersistentState<QualityProtocol[]>('erp_quality_protocols', migrate(INITIAL_QUALITY_PROTOCOLS));
  const [allQualityInspections, setAllQualityInspections] = usePersistentState<QualityInspection[]>('erp_quality_inspections', []);
  const [allNonConformities, setAllNonConformities] = usePersistentState<NonConformity[]>('erp_non_conformities', []);

  // --- FILTERED DATA (MULTITENANT) ---
  const materials = useMemo(() => allMaterials.filter(x => x.organizationId === orgId), [allMaterials, orgId]);
  const tasks = useMemo(() => allTasks.filter(x => x.organizationId === orgId), [allTasks, orgId]);
  const tools = useMemo(() => allTools.filter(x => x.organizationId === orgId), [allTools, orgId]);
  const laborCategories = useMemo(() => allLaborCategories.filter(x => x.organizationId === orgId), [allLaborCategories, orgId]);
  const crews = useMemo(() => allCrews.filter(x => x.organizationId === orgId), [allCrews, orgId]);
  
  // --- PROJECT LOGIC ---
  const projects = useMemo(() => allProjects.filter(x => x.organizationId === orgId), [allProjects, orgId]);
  
  const project = useMemo(() => {
      // Find active project or default to the first one, or a placeholder if none exist
      // NOTE: Logic slightly changed to support ProjectSelector. If no activeProjectId is set, we might return a default but UI should handle 'null' ID.
      return projects.find(p => p.id === activeProjectId) || projects[0] || { 
          ...INITIAL_PROJECT, 
          id: `new_${orgId}`, 
          organizationId: orgId, 
          name: 'Nuevo Proyecto', 
          items: [] 
      };
  }, [projects, activeProjectId, orgId]);

  const snapshots = useMemo(() => allSnapshots.filter(x => x.organizationId === orgId), [allSnapshots, orgId]);
  const receptions = useMemo(() => allReceptions.filter(x => x.organizationId === orgId), [allReceptions, orgId]);
  const subcontractors = useMemo(() => allSubcontractors.filter(x => x.organizationId === orgId), [allSubcontractors, orgId]);
  const contracts = useMemo(() => allContracts.filter(x => x.organizationId === orgId), [allContracts, orgId]);
  const certifications = useMemo(() => allCertifications.filter(x => x.organizationId === orgId), [allCertifications, orgId]);
  const documents = useMemo(() => allDocuments.filter(x => x.organizationId === orgId && x.projectId === project.id), [allDocuments, orgId, project.id]);
  const measurementSheets = useMemo(() => allMeasurementSheets.filter(x => x.organizationId === orgId), [allMeasurementSheets, orgId]);
  
  const qualityProtocols = useMemo(() => allQualityProtocols.filter(x => x.organizationId === orgId), [allQualityProtocols, orgId]);
  const qualityInspections = useMemo(() => allQualityInspections.filter(x => x.organizationId === orgId && x.projectId === project.id), [allQualityInspections, orgId, project.id]);
  const nonConformities = useMemo(() => allNonConformities.filter(x => x.organizationId === orgId && x.projectId === project.id), [allNonConformities, orgId, project.id]);

  // --- OPTIMIZATION INDEXES ---
  const materialsMap = useMemo(() => {
    return materials.reduce((acc, m) => { acc[m.id] = m; return acc; }, {} as Record<string, Material>);
  }, [materials]);

  const tasksMap = useMemo(() => {
    return tasks.reduce((acc, t) => { acc[t.id] = t; return acc; }, {} as Record<string, Task>);
  }, [tasks]);

  const toolsMap = useMemo(() => {
    return tools.reduce((acc, t) => { acc[t.id] = t; return acc; }, {} as Record<string, Tool>);
  }, [tools]);

  const laborCategoriesMap = useMemo(() => {
    return laborCategories.reduce((acc, t) => { acc[t.id] = t; return acc; }, {} as Record<string, LaborCategory>);
  }, [laborCategories]);

  const crewsMap = useMemo(() => {
    return crews.reduce((acc, t) => { acc[t.id] = t; return acc; }, {} as Record<string, Crew>);
  }, [crews]);

  const yieldsIndex = useMemo(() => {
    const index: Record<string, TaskYield[]> = {};
    yields.forEach(y => {
      if(!index[y.taskId]) index[y.taskId] = [];
      index[y.taskId].push(y);
    });
    return index;
  }, [yields]);

  const toolYieldsIndex = useMemo(() => {
    const index: Record<string, TaskToolYield[]> = {};
    toolYields.forEach(y => {
      if(!index[y.taskId]) index[y.taskId] = [];
      index[y.taskId].push(y);
    });
    return index;
  }, [toolYields]);

  const taskCrewYieldsIndex = useMemo(() => {
    const index: Record<string, TaskCrewYield[]> = {};
    taskCrewYields.forEach(y => {
      if(!index[y.taskId]) index[y.taskId] = [];
      index[y.taskId].push(y);
    });
    return index;
  }, [taskCrewYields]);


  // --- ACTIONS (Inject OrgId) ---

  const addMaterial = (m: Material) => setAllMaterials(prev => [...prev, { ...m, organizationId: orgId }]);
  const updateMaterial = (id: string, updates: Partial<Material>) => 
    setAllMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  const removeMaterial = (id: string) => setAllMaterials(prev => prev.filter(m => m.id !== id));

  const addTask = (t: Task) => setAllTasks(prev => [...prev, { ...t, organizationId: orgId }]);
  
  const updateTask = (id: string, updates: Partial<Task>) => 
    setAllTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

  // NEW: Master Sync Function
  const updateTaskMaster = (taskId: string, updates: Partial<Task>) => {
      // 1. Update basic task info
      updateTask(taskId, updates);

      // 2. Cascade Update Resources if present in 'updates'
      // Materials Sync
      if (updates.materialsYield) {
          setYields(prev => {
              const others = prev.filter(y => y.taskId !== taskId);
              return [...others, ...updates.materialsYield!];
          });
      }

      // Tools Sync
      if (updates.equipmentYield) {
          setToolYields(prev => {
              const others = prev.filter(y => y.taskId !== taskId);
              return [...others, ...updates.equipmentYield!];
          });
      }

      // Crews/Labor Sync
      if (updates.laborYield) {
          setTaskCrewYields(prev => {
              const others = prev.filter(y => y.taskId !== taskId);
              return [...others, ...updates.laborYield!];
          });
      }
  };

  const removeTask = (id: string) => setAllTasks(prev => prev.filter(t => t.id !== id));

  const addTool = (t: Tool) => setAllTools(prev => [...prev, { ...t, organizationId: orgId }]);
  const updateTool = (id: string, updates: Partial<Tool>) => 
    setAllTools(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  const removeTool = (id: string) => setAllTools(prev => prev.filter(t => t.id !== id));

  const addLaborCategory = (lc: LaborCategory) => setAllLaborCategories(prev => [...prev, { ...lc, organizationId: orgId }]);
  const updateLaborCategory = (id: string, updates: Partial<LaborCategory>) => 
    setAllLaborCategories(prev => prev.map(lc => lc.id === id ? { ...lc, ...updates } : lc));
  const removeLaborCategory = (id: string) => setAllLaborCategories(prev => prev.filter(lc => lc.id !== id));

  const addCrew = (c: Crew) => setAllCrews(prev => [...prev, { ...c, organizationId: orgId }]);
  const updateCrew = (id: string, updates: Partial<Crew>) => 
    setAllCrews(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  const removeCrew = (id: string) => setAllCrews(prev => prev.filter(c => c.id !== id));
  
  const addRubro = (name: string) => setRubros(prev => [...prev, name].sort());
  const removeRubro = (name: string) => setRubros(prev => prev.filter(r => r !== name));

  // --- PROJECT ACTIONS ---
  const setActiveProject = (id: string) => {
      setActiveProjectId(id);
  };

  const exitProject = () => {
      setActiveProjectId(null);
  };

  const createNewProject = (data: Partial<Project>) => {
      const newId = `proj_${crypto.randomUUID().substring(0,8)}`;
      const newProject: Project = {
          ...INITIAL_PROJECT,
          ...data,
          id: newId,
          organizationId: orgId,
          items: data.items || []
      };
      setAllProjects(prev => [...prev, newProject]);
      setActiveProjectId(newId);
  };

  const deleteProject = (id: string) => {
      setAllProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) {
          setActiveProjectId(null);
      }
  };

  const updateProjectSettings = (p: Partial<Project>) => {
    // Update the *Active* project
    setAllProjects(prev => prev.map(proj => 
        (proj.id === project.id && proj.organizationId === orgId) ? { ...proj, ...p } : proj
    ));
  };

  // --- SAVE PROJECT ACTION (MANUAL TRIGGER) ---
  const saveProject = async () => {
      // Force a refresh of the project state to the persistent storage.
      return new Promise<void>((resolve) => {
          setTimeout(() => {
              setAllProjects(prev => [...prev]);
              resolve();
          }, 600); // Simulate network/save delay for UX
      });
  };

  const addBudgetItem = (item: BudgetItem) => {
    updateProjectSettings({ items: [...project.items, item] });
  };

  const removeBudgetItem = (itemId: string) => {
    updateProjectSettings({ items: project.items.filter(i => i.id !== itemId) });
  };

  const updateBudgetItem = (itemId: string, updates: Partial<BudgetItem>) => {
    updateProjectSettings({ items: project.items.map(i => i.id === itemId ? { ...i, ...updates } : i) });
  };

  const addTaskYield = (y: TaskYield) => {
    setYields(prev => {
        const exists = prev.some(i => i.taskId === y.taskId && i.materialId === y.materialId);
        if (exists) {
            return prev.map(i => (i.taskId === y.taskId && i.materialId === y.materialId) ? y : i);
        }
        return [...prev, y];
    });
  };

  const removeTaskYield = (taskId: string, materialId: string) => setYields(prev => prev.filter(i => !(i.taskId === taskId && i.materialId === materialId)));
  
  const addTaskToolYield = (y: TaskToolYield) => {
    setToolYields(prev => {
        const exists = prev.some(i => i.taskId === y.taskId && i.toolId === y.toolId);
        if (exists) {
            return prev.map(i => (i.taskId === y.taskId && i.toolId === y.toolId) ? y : i);
        }
        return [...prev, y];
    });
  };

  const removeTaskToolYield = (taskId: string, toolId: string) => setToolYields(prev => prev.filter(i => !(i.taskId === taskId && i.toolId === toolId)));

  const addTaskCrewYield = (y: TaskCrewYield) => {
    setTaskCrewYields(prev => {
        const exists = prev.some(i => i.taskId === y.taskId && i.crewId === y.crewId);
        if (exists) {
            return prev.map(i => (i.taskId === y.taskId && i.crewId === y.crewId) ? y : i);
        }
        return [...prev, y];
    });
  };

  const removeTaskCrewYield = (taskId: string, crewId: string) => setTaskCrewYields(prev => prev.filter(i => !(i.taskId === taskId && i.crewId === crewId)));

  const loadTemplate = (template: ProjectTemplate) => {
    const newTasks: Task[] = [];
    const newBudgetItems: BudgetItem[] = [];

    template.tasks.forEach(t => {
      let taskId = t.id;
      const existing = tasks.find(et => et.name.toLowerCase() === t.name.toLowerCase());
      if (existing) {
        taskId = existing.id;
      } else {
        taskId = `t_${crypto.randomUUID().substring(0,8)}`;
        newTasks.push({ ...t, id: taskId, organizationId: orgId });
      }

      newBudgetItems.push({
        id: crypto.randomUUID(),
        taskId: taskId,
        quantity: 1, 
        manualDuration: 0
      });
    });

    if (newTasks.length > 0) {
      setAllTasks(prev => [...prev, ...newTasks]);
    }
    
    // Update active project
    updateProjectSettings({ items: [...project.items, ...newBudgetItems] });
  };

  const createSnapshot = (name: string, totalCost: number) => {
      const newSnapshot: Snapshot = {
          id: crypto.randomUUID(),
          organizationId: orgId,
          date: new Date().toISOString(),
          name,
          totalCost,
          items: JSON.parse(JSON.stringify(project.items)),
          materialsSnapshot: JSON.parse(JSON.stringify(materials))
      };
      setAllSnapshots(prev => [newSnapshot, ...prev]);
  };

  const addReception = (reception: Reception) => {
      setAllReceptions(prev => [{ ...reception, organizationId: orgId }, ...prev]);
  };

  const getProjectStockStatus = (): MaterialStockStatus[] => {
      const status: Record<string, MaterialStockStatus> = {};
      
      project.items.forEach(item => {
          // Optimized Lookup
          const taskYields = yieldsIndex[item.taskId] || [];
          taskYields.forEach(ty => {
              if (!status[ty.materialId]) {
                  const mat = materialsMap[ty.materialId];
                  if (mat) {
                      status[ty.materialId] = { material: mat, budgeted: 0, received: 0, pending: 0 };
                  }
              }
              if (status[ty.materialId]) {
                  status[ty.materialId].budgeted += ty.quantity * item.quantity;
              }
          });
      });

      receptions.forEach(rec => {
          if (rec.projectId === project.id) {
              rec.items.forEach(ri => {
                  if (status[ri.materialId]) {
                      status[ri.materialId].received += ri.quantityReceived;
                  } else {
                      const mat = materialsMap[ri.materialId];
                      if(mat) {
                         status[ri.materialId] = { material: mat, budgeted: 0, received: ri.quantityReceived, pending: 0 };
                      }
                  }
              });
          }
      });

      Object.values(status).forEach(s => {
          s.pending = Math.max(0, s.budgeted - s.received);
      });

      return Object.values(status).sort((a,b) => b.pending - a.pending); 
  };

  const resetData = () => {
    setAllMaterials(prev => prev.filter(x => x.organizationId !== orgId));
    setAllTasks(prev => prev.filter(x => x.organizationId !== orgId));
    setAllProjects(prev => prev.filter(x => x.organizationId !== orgId));
    setActiveProjectId(null);
  };

  // --- DATABASE EXPORT / IMPORT (PERSISTENCE) ---
  const exportDatabase = (): string => {
      const db = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          data: {
              allMaterials,
              allTasks,
              allTools,
              allLaborCategories,
              allCrews,
              allProjects,
              yields,
              toolYields,
              taskCrewYields,
              rubros,
              calendarPresets,
              allDocuments,
              allMeasurementSheets,
              allQualityProtocols,
              allQualityInspections,
              allNonConformities
          }
      };
      return JSON.stringify(db, null, 2);
  };

  const importDatabase = (json: string): ImportResult => {
      try {
          const db = JSON.parse(json);
          if (!db.data) return { success: false, message: 'Formato de respaldo inválido.' };
          
          if(confirm('ADVERTENCIA: Esta acción sobrescribirá todos los datos actuales. ¿Desea continuar?')) {
              setAllMaterials(db.data.allMaterials || []);
              setAllTasks(db.data.allTasks || []);
              setAllTools(db.data.allTools || []);
              setAllLaborCategories(db.data.allLaborCategories || []);
              setAllCrews(db.data.allCrews || []);
              setAllProjects(db.data.allProjects || []);
              setYields(db.data.yields || []);
              setToolYields(db.data.toolYields || []);
              setTaskCrewYields(db.data.taskCrewYields || []);
              setRubros(db.data.rubros || INITIAL_RUBROS);
              setCalendarPresets(db.data.calendarPresets || []);
              setAllDocuments(db.data.allDocuments || []);
              setAllMeasurementSheets(db.data.allMeasurementSheets || []);
              setAllQualityProtocols(db.data.allQualityProtocols || []);
              setAllQualityInspections(db.data.allQualityInspections || []);
              setAllNonConformities(db.data.allNonConformities || []);
              
              // Reset active state
              setActiveProjectId(null);
              
              return { success: true, message: 'Base de datos restaurada correctamente.' };
          }
          return { success: false, message: 'Restauración cancelada.' };
      } catch (e) {
          return { success: false, message: 'Error al leer el archivo JSON.' };
      }
  };

  const importData = (type: 'materials' | 'tasks' | 'tools' | 'labor', jsonData: string): ImportResult => {
    try {
      const parsed = JSON.parse(jsonData);
      if (!Array.isArray(parsed)) return { success: false, message: 'Formato inválido.' };
      
      const enriched = parsed.map(i => ({...i, organizationId: orgId}));

      if (type === 'materials') setAllMaterials(prev => [...prev, ...enriched]);
      else if (type === 'tasks') setAllTasks(prev => [...prev, ...enriched]);
      else if (type === 'tools') setAllTools(prev => [...prev, ...enriched]);
      else if (type === 'labor') setAllLaborCategories(prev => [...prev, ...enriched]);
      return { success: true, message: 'Importación exitosa.' };
    } catch (e) {
      return { success: false, message: 'Error en el JSON.' };
    }
  };

  const addSubcontractor = (s: Subcontractor) => setAllSubcontractors(prev => [...prev, { ...s, organizationId: orgId }]);
  const updateSubcontractor = (id: string, updates: Partial<Subcontractor>) => 
      setAllSubcontractors(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  
  const addContract = (c: Contract) => setAllContracts(prev => [...prev, { ...c, organizationId: orgId }]);
  const addCertification = (c: Certification) => setAllCertifications(prev => [...prev, { ...c, organizationId: orgId }]);

  // Calendar Presets
  const addCalendarPreset = (preset: CalendarPreset) => {
      setCalendarPresets(prev => [...prev, preset]);
  };

  const applyCalendarPreset = (presetId: string) => {
      const preset = calendarPresets.find(p => p.id === presetId);
      if (preset) {
          updateProjectSettings({
              workdayHours: preset.workdayHours,
              workdayStartTime: preset.workdayStartTime,
              workdayEndTime: preset.workdayEndTime,
              lunchBreakDuration: preset.lunchBreakDuration,
              workingDays: preset.workingDays,
              nonWorkingDates: preset.nonWorkingDates
          });
      }
  };

  // --- DOCUMENTS MANAGEMENT ---
  const addDocument = (doc: ProjectDocument) => {
      setAllDocuments(prev => [doc, ...prev]);
  };

  const removeDocument = (id: string) => {
      setAllDocuments(prev => prev.filter(d => d.id !== id));
  };

  // --- MEASUREMENT SHEETS MANAGEMENT ---
  const saveMeasurementSheet = (sheet: MeasurementSheet) => {
      setAllMeasurementSheets(prev => {
          const exists = prev.find(s => s.id === sheet.id);
          if (exists) {
              return prev.map(s => s.id === sheet.id ? sheet : s);
          }
          return [...prev, sheet];
      });
  };

  // The Bridge: Update Budget Item Quantity based on Measurement Sheet Total
  const syncMeasurementToBudget = (sheetId: string) => {
      const sheet = allMeasurementSheets.find(s => s.id === sheetId);
      if (!sheet) return;
      
      updateBudgetItem(sheet.budgetItemId, { quantity: sheet.totalQuantity });
  };

  // --- QUALITY MANAGEMENT ---
  const addQualityProtocol = (p: QualityProtocol) => setAllQualityProtocols(prev => [...prev, {...p, organizationId: orgId}]);
  const updateQualityProtocol = (id: string, updates: Partial<QualityProtocol>) => 
      setAllQualityProtocols(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  
  const addQualityInspection = (i: QualityInspection) => setAllQualityInspections(prev => [i, ...prev]);
  const addNonConformity = (n: NonConformity) => setAllNonConformities(prev => [n, ...prev]);
  const updateNonConformity = (id: string, updates: Partial<NonConformity>) =>
      setAllNonConformities(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));

  return (
    <ERPContext.Provider value={{
      materials, tasks, yields, tools, toolYields, laborCategories, crews, rubros, project, projects, activeProjectId,
      snapshots, receptions, subcontractors, contracts, certifications, calendarPresets, documents, measurementSheets, taskCrewYields,
      qualityProtocols, qualityInspections, nonConformities,
      // Indexes
      materialsMap, tasksMap, toolsMap, yieldsIndex, toolYieldsIndex, laborCategoriesMap, crewsMap, taskCrewYieldsIndex,
      // Actions
      addMaterial, updateMaterial, removeMaterial,
      addTask, updateTask, updateTaskMaster, removeTask,
      addTool, updateTool, removeTool,
      addLaborCategory, updateLaborCategory, removeLaborCategory,
      addCrew, updateCrew, removeCrew,
      addRubro, removeRubro,
      updateProjectSettings, addBudgetItem, removeBudgetItem, updateBudgetItem,
      addTaskYield, removeTaskYield, addTaskToolYield, removeTaskToolYield, addTaskCrewYield, removeTaskCrewYield,
      loadTemplate, importData, createSnapshot, resetData,
      exportDatabase, importDatabase,
      addReception, getProjectStockStatus,
      addSubcontractor, updateSubcontractor, addContract, addCertification,
      addCalendarPreset, applyCalendarPreset,
      addDocument, removeDocument, saveMeasurementSheet, syncMeasurementToBudget,
      createNewProject, setActiveProject, deleteProject, saveProject, exitProject,
      // Quality
      addQualityProtocol, updateQualityProtocol, addQualityInspection, addNonConformity, updateNonConformity
    }}>
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = () => {
  const context = useContext(ERPContext);
  if (!context) throw new Error("useERP must be used within an ERPProvider");
  return context;
};
