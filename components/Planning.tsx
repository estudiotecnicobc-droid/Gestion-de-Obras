
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { addWorkingDays, diffDays, addDays } from '../services/calculationService';
import { 
  Calendar, Clock, AlertCircle, ArrowDown, Calculator, 
  ChevronsRight, Users, Check, Layout, List, PenTool,
  ZoomIn, ZoomOut, MoveRight
} from 'lucide-react';
import { LinkType } from '../types';
import { APUBuilder } from './APUBuilder';

export const Planning: React.FC = () => {
  const { 
    project, tasks, updateBudgetItem,
  } = useERP();
  
  // --- UI STATE ---
  const [viewMode, setViewMode] = useState<'table' | 'gantt'>('table');
  const [editingApuId, setEditingApuId] = useState<string | null>(null);
  
  // Gantt Specific State
  const [ganttScale, setGanttScale] = useState(40); // Pixels per day
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Working Days Config
  const workingDays = project.workingDays || [1,2,3,4,5]; 
  const nonWorkingDates = project.nonWorkingDates || [];
  const workdayHours = project.workdayHours || 9;

  // --- 1. SCHEDULING ENGINE (FORWARD PASS) ---
  const scheduledItems = useMemo(() => {
    const items = project.items.map((item, index) => ({ ...item, index: index + 1 }));
    const results: any[] = [];
    const processedIds = new Set<string>();
    const getProcessedItem = (id: string) => results.find(r => r.id === id);

    let iterations = 0;
    while (processedIds.size < items.length && iterations < 100) {
      let somethingProcessed = false;
      items.forEach(item => {
        if (processedIds.has(item.id)) return;

        const task = tasks.find(t => t.id === item.taskId);
        if (!task) return;

        const quantity = item.quantity || 0;
        const crewSize = item.crewsAssigned || 1; 
        const dailyCapacity = task.dailyYield * crewSize;
        
        // Duration Calculation
        const calculatedDuration = dailyCapacity > 0 ? Math.ceil(quantity / dailyCapacity) : 1;
        const duration = item.manualDuration || calculatedDuration;
        
        // Predecessor Logic (Early Start)
        let startDate = item.startDate || project.startDate;

        if (item.dependencies && item.dependencies.length > 0) {
          let maxStartDate = new Date(project.startDate).getTime();
          let allDepsReady = true;

          item.dependencies.forEach(dep => {
            const pred = getProcessedItem(dep.predecessorId);
            if (!pred) { allDepsReady = false; return; }
            
            const predEnd = new Date(pred.end).getTime();
            // Default FS (Finish-to-Start) logic: Start next working day
            const calculatedStart = predEnd + 86400000; 
            maxStartDate = Math.max(maxStartDate, calculatedStart);
          });

          if (!allDepsReady) return;
          startDate = new Date(maxStartDate).toISOString().split('T')[0];
        }

        // Ensure start date is a working day
        startDate = addWorkingDays(addDays(startDate, -1), 1, workingDays, nonWorkingDates); // Hack to snap to valid day

        const endDate = addWorkingDays(startDate, duration, workingDays, nonWorkingDates);
        
        results.push({
          ...item,
          taskName: task.name,
          category: task.category || 'Sin Categoría',
          start: startDate, 
          end: endDate,     
          duration,
          yieldHH: task.yieldHH || 0,
          dailyCapacity,
          crewSize,
          // Temp fields for CPM
          earlyStart: new Date(startDate).getTime(),
          earlyFinish: new Date(endDate).getTime()
        });
        processedIds.add(item.id);
        somethingProcessed = true;
      });
      if (!somethingProcessed) break;
      iterations++;
    }
    
    return results.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [project, tasks, workingDays, nonWorkingDates, workdayHours]);

  // --- 2. CRITICAL PATH METHOD (BACKWARD PASS) ---
  const cpmItems = useMemo(() => {
      if (scheduledItems.length === 0) return [];

      // 1. Find Project Finish Date (Max Early Finish)
      const projectFinish = Math.max(...scheduledItems.map(i => i.earlyFinish));

      // 2. Map for quick access
      const itemMap = new Map(scheduledItems.map(i => [i.id, { ...i, lateStart: 0, lateFinish: 0, totalFloat: 0, isCritical: false }]));

      // 3. Initialize Late Finish for tasks with no successors (they determine project end)
      //    Actually, simpler: Initialize ALL Late Finishes to Project Finish initially? No.
      //    Correct way: Identify successors for each node.
      const successors: Record<string, string[]> = {};
      scheduledItems.forEach(item => {
          if(!successors[item.id]) successors[item.id] = [];
          item.dependencies?.forEach(dep => {
              if(!successors[dep.predecessorId]) successors[dep.predecessorId] = [];
              successors[dep.predecessorId].push(item.id);
          });
      });

      // 4. Backward Pass
      // Iterate in reverse start order (roughly topological reverse)
      const sortedReverse = [...scheduledItems].sort((a, b) => b.earlyFinish - a.earlyFinish);

      sortedReverse.forEach(item => {
          const node = itemMap.get(item.id)!;
          const itemSuccessors = successors[item.id] || [];

          if (itemSuccessors.length === 0) {
              // No successors, LF = Project Finish
              node.lateFinish = projectFinish;
          } else {
              // LF = Min(LS of successors)
              let minLS = Number.MAX_VALUE;
              itemSuccessors.forEach(succId => {
                  const succ = itemMap.get(succId);
                  // Assuming FS relationship: LS of successor - 1 day (gap) roughly
                  // Ideally calculate based on dependency lag. 
                  // Simplified: LS of successor. Since Succ Start depends on Node End.
                  if (succ && succ.lateStart < minLS) {
                      minLS = succ.lateStart;
                  }
              });
              // Adjust for the gap (Start of Succ is usually End of Pred + 1 day)
              // So End of Pred should be Start of Succ - 1 day approx (in working days logic)
              // For simplicity in pixels/time, let's say LF = minLS.
              node.lateFinish = minLS; 
          }

          // LS = LF - Duration
          // Note: Duration in days needs to be converted to time delta roughly or use working days logic reverse.
          // Simplified CPM using milliseconds:
          const durationMs = item.earlyFinish - item.earlyStart;
          node.lateStart = node.lateFinish - durationMs;

          // Float = LS - ES (or LF - EF)
          // Allow small epsilon for floating point dates
          const float = (node.lateFinish - node.earlyFinish) / (1000 * 60 * 60 * 24);
          
          node.totalFloat = Math.max(0, float);
          // Critical if Float is effectively 0 (e.g. < 1 day)
          node.isCritical = node.totalFloat < 0.9;
      });

      return Array.from(itemMap.values()).sort((a, b) => a.earlyStart - b.earlyStart);
  }, [scheduledItems]);

  // --- CRITICAL PATH SUMMARY ---
  const criticalPathStats = useMemo(() => {
      if (cpmItems.length === 0) return { finishDate: new Date(), totalDays: 0 };
      const maxEndDate = Math.max(...cpmItems.map(i => i.earlyFinish));
      const finishDate = new Date(maxEndDate);
      const startDate = new Date(project.startDate);
      const totalDays = diffDays(project.startDate, finishDate.toISOString().split('T')[0]);
      return { finishDate, totalDays };
  }, [cpmItems, project.startDate]);

  // --- HANDLERS ---
  const handleUpdate = (id: string, field: string, value: any) => {
      updateBudgetItem(id, { [field]: value });
  };

  const handleSetPredecessor = (itemId: string, predId: string) => {
      const deps = predId ? [{ predecessorId: predId, type: LinkType.FS, lag: 0 }] : [];
      updateBudgetItem(itemId, { dependencies: deps });
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-blue-600" /> Planificación de Obra
            </h2>
            <p className="text-sm text-slate-500 mt-1">Motor de cálculo CPM (Ruta Crítica) basado en Rendimientos Maestros.</p>
         </div>
         
         <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
             <div className="text-right border-r border-slate-200 pr-4">
                 <div className="text-[10px] font-bold text-slate-400 uppercase">Fin de Obra Estimado</div>
                 <div className="text-lg font-bold text-slate-800">{criticalPathStats.finishDate.toLocaleDateString()}</div>
             </div>
             <div className="text-right">
                 <div className="text-[10px] font-bold text-slate-400 uppercase">Duración Total</div>
                 <div className="text-lg font-bold text-blue-600">{criticalPathStats.totalDays} días</div>
             </div>
         </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex gap-2">
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'table' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                      <List size={16} /> Tabla de Cálculo
                  </button>
                  <button 
                    onClick={() => setViewMode('gantt')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'gantt' ? 'bg-white text-blue-600 shadow' : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                      <Layout size={16} /> Diagrama Gantt
                  </button>
              </div>
              
              {viewMode === 'gantt' && (
                  <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200">
                      <button onClick={() => setGanttScale(s => Math.max(20, s - 5))} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ZoomOut size={16}/></button>
                      <span className="text-xs font-mono w-8 text-center">{ganttScale}</span>
                      <button onClick={() => setGanttScale(s => Math.min(100, s + 5))} className="p-1 hover:bg-slate-100 rounded text-slate-500"><ZoomIn size={16}/></button>
                  </div>
              )}

              <div className="text-xs text-slate-500 font-medium">
                  Jornada: <strong>{workdayHours}hs</strong>
              </div>
          </div>

          {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-bold sticky top-0 z-10">
                          <tr>
                              <th className="p-3 border-r border-slate-200 w-12 text-center">ID</th>
                              <th className="p-3 border-r border-slate-200 min-w-[200px]">Actividad</th>
                              <th className="p-3 border-r border-slate-200 w-24 text-center bg-blue-50/50">Cómputo</th>
                              <th className="p-3 border-r border-slate-200 w-24 text-center bg-orange-50/50">Frentes (Cuadrillas)</th>
                              <th className="p-3 border-r border-slate-200 w-24 text-center">Rend. Base (u/día)</th>
                              <th className="p-3 border-r border-slate-200 w-24 text-center">Prod. Total</th>
                              <th className="p-3 border-r border-slate-200 w-24 text-center font-black text-slate-700">Duración (Días)</th>
                              <th className="p-3 border-r border-slate-200 w-40 text-center">Precedencia</th>
                              <th className="p-3 border-r border-slate-200 w-28 text-center">Fecha Inicio</th>
                              <th className="p-3 w-28 text-center">Fecha Fin</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                          {cpmItems.map((item, idx) => (
                              <tr key={item.id} className={`hover:bg-slate-50 transition-colors group ${item.isCritical ? 'bg-red-50/30' : ''}`}>
                                  <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="p-2 font-medium text-slate-700 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                          {item.isCritical && <AlertCircle size={12} className="text-red-500" />}
                                          <div>
                                              {item.taskName}
                                              <div className="text-[9px] text-slate-400 font-normal">{item.category}</div>
                                          </div>
                                      </div>
                                      <button onClick={() => setEditingApuId(item.taskId)} className="text-purple-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Ajustar Rendimiento Maestro">
                                          <PenTool size={14} />
                                      </button>
                                  </td>
                                  
                                  {/* INPUT: Quantity */}
                                  <td className="p-2 text-center bg-blue-50/30">
                                      <input 
                                        type="number" 
                                        className="w-16 p-1 text-center border border-slate-300 rounded font-bold text-slate-700 focus:border-blue-500 outline-none"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdate(item.id, 'quantity', parseFloat(e.target.value))}
                                      />
                                  </td>

                                  {/* INPUT: Crew Size */}
                                  <td className="p-2 text-center bg-orange-50/30">
                                      <div className="flex justify-center items-center gap-1">
                                          <Users size={12} className="text-orange-400" />
                                          <input 
                                            type="number" 
                                            min="1"
                                            className="w-12 p-1 text-center border border-slate-300 rounded font-bold text-slate-700 focus:border-orange-500 outline-none"
                                            value={item.crewSize}
                                            onChange={(e) => handleUpdate(item.id, 'crewsAssigned', parseInt(e.target.value))}
                                          />
                                      </div>
                                  </td>

                                  {/* READ ONLY: Yield (Base) */}
                                  <td className="p-2 text-center text-slate-500">
                                      {(item.dailyCapacity / item.crewSize).toFixed(2)}
                                  </td>

                                  {/* CALC: Daily Capacity */}
                                  <td className="p-2 text-center text-slate-500 font-mono">
                                      {item.dailyCapacity.toFixed(2)}
                                  </td>

                                  {/* CALC: Duration */}
                                  <td className="p-2 text-center font-black text-blue-600 bg-slate-50 text-sm border-l border-r border-slate-100">
                                      {item.duration}
                                  </td>

                                  {/* INPUT: Predecessor */}
                                  <td className="p-2 text-center">
                                      <select 
                                        className="w-full p-1 border border-slate-200 rounded text-[10px] text-slate-600 truncate"
                                        value={item.dependencies?.[0]?.predecessorId || ''}
                                        onChange={(e) => handleSetPredecessor(item.id, e.target.value)}
                                      >
                                          <option value="">-- Inicio --</option>
                                          {cpmItems
                                            .filter(i => i.id !== item.id) // Avoid self-loop
                                            .map(i => (
                                              <option key={i.id} value={i.id}>{i.taskName.substring(0, 30)}...</option>
                                          ))}
                                      </select>
                                  </td>

                                  {/* CALC: Dates */}
                                  <td className="p-2 text-center text-slate-600">
                                      {new Date(item.start).toLocaleDateString()}
                                  </td>
                                  <td className="p-2 text-center font-bold text-slate-700">
                                      {new Date(item.end).toLocaleDateString()}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          ) : (
              // --- GANTT CHART RENDERER ---
              <div className="flex-1 overflow-auto bg-slate-50 relative" ref={scrollContainerRef}>
                  <div className="absolute top-0 left-0 min-w-full h-full">
                      {/* SVG Canvas */}
                      <svg 
                          width={Math.max(1000, criticalPathStats.totalDays * ganttScale + 400)} 
                          height={cpmItems.length * 40 + 60}
                          className="font-sans"
                      >
                          <defs>
                              <pattern id="grid" width={ganttScale} height="100%" patternUnits="userSpaceOnUse">
                                  <line x1={ganttScale} y1="0" x2={ganttScale} y2="100%" stroke="#e2e8f0" strokeWidth="1" />
                              </pattern>
                              <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="0" refY="2" orient="auto">
                                  <polygon points="0 0, 6 2, 0 4" fill="#94a3b8" />
                              </marker>
                          </defs>

                          {/* Background Grid */}
                          <rect width="100%" height="100%" fill="url(#grid)" />

                          {/* Timeline Header */}
                          <g>
                              {Array.from({ length: criticalPathStats.totalDays + 5 }).map((_, i) => (
                                  <text 
                                    key={i} 
                                    x={i * ganttScale + 10} 
                                    y="20" 
                                    fontSize="10" 
                                    fill="#64748b" 
                                    fontWeight="bold"
                                  >
                                      D{i+1}
                                  </text>
                              ))}
                          </g>

                          {/* Task Bars & Logic */}
                          {cpmItems.map((item, index) => {
                              const projectStart = new Date(project.startDate).getTime();
                              const itemStart = new Date(item.start).getTime();
                              
                              // Calculate pixel offset days
                              const startOffsetDay = Math.floor((itemStart - projectStart) / (1000 * 60 * 60 * 24));
                              const x = startOffsetDay * ganttScale;
                              const width = item.duration * ganttScale;
                              const y = index * 40 + 40;
                              
                              // Bar Color: Red if Critical, Blue if Normal
                              const barColor = item.isCritical ? '#ef4444' : '#3b82f6';
                              const barOpacity = item.isCritical ? 0.9 : 0.7;

                              return (
                                  <g key={item.id} className="group cursor-pointer" onClick={() => setEditingApuId(item.taskId)}>
                                      {/* Dependency Lines */}
                                      {item.dependencies?.map((dep, depIdx) => {
                                          const pred = cpmItems.find(p => p.id === dep.predecessorId);
                                          if (!pred) return null;
                                          
                                          // Find predator index/position
                                          const predIdx = cpmItems.indexOf(pred);
                                          const predStartDay = Math.floor((new Date(pred.start).getTime() - projectStart) / (1000 * 60 * 60 * 24));
                                          const predXEnd = (predStartDay + pred.duration) * ganttScale;
                                          const predY = predIdx * 40 + 40 + 15; // Center of bar
                                          
                                          const currY = y + 15;
                                          
                                          // Draw Bezier Connector
                                          const path = `M ${predXEnd} ${predY} 
                                                        C ${predXEnd + 15} ${predY}, ${x - 15} ${currY}, ${x} ${currY}`;
                                          
                                          return (
                                              <path 
                                                key={`${item.id}-dep-${depIdx}`} 
                                                d={path} 
                                                fill="none" 
                                                stroke="#94a3b8" 
                                                strokeWidth="1.5" 
                                                markerEnd="url(#arrowhead)"
                                                className="opacity-50"
                                              />
                                          );
                                      })}

                                      {/* Task Bar */}
                                      <rect 
                                          x={x} 
                                          y={y} 
                                          width={width} 
                                          height="30" 
                                          rx="4" 
                                          fill={barColor}
                                          fillOpacity={barOpacity}
                                          className="transition-all hover:fill-opacity-100 hover:stroke hover:stroke-slate-600"
                                      />
                                      
                                      {/* Progress Inner Bar (Mocked as solid bottom line if progress > 0) */}
                                      {item.progress > 0 && (
                                          <rect x={x} y={y + 25} width={width * (item.progress / 100)} height="5" fill="white" fillOpacity="0.5" />
                                      )}

                                      {/* Label */}
                                      <text x={x + 10} y={y + 19} fontSize="11" fill="white" fontWeight="bold" pointerEvents="none" className="select-none">
                                          {width > 60 ? item.taskName.substring(0, 20) : ''}
                                      </text>
                                      
                                      {/* Outer Label (if short bar) */}
                                      {width <= 60 && (
                                          <text x={x + width + 5} y={y + 19} fontSize="11" fill="#475569" fontWeight="medium">
                                              {item.taskName}
                                          </text>
                                      )}
                                  </g>
                              );
                          })}
                      </svg>
                  </div>
              </div>
          )}
          
          <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-xs">
              <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span>Ruta Crítica (Holgura &lt; 1 día)</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span>Tarea Normal</span>
                  </div>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-bold border border-blue-200">
                  <Calculator size={14} />
                  <span>Fórmula: Duración = Cómputo / (Rendimiento Base × Frentes de Ataque)</span>
              </div>
          </div>
      </div>

      {editingApuId && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <APUBuilder taskId={editingApuId} onClose={() => setEditingApuId(null)} />
              </div>
          </div>
      )}
    </div>
  );
};
