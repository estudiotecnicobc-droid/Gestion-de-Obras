import React, { useMemo, useState, Fragment } from 'react';
import { useERP } from '../context/ERPContext';
import { calculateUnitPrice } from '../services/calculationService';
import { 
  useReactTable, 
  getCoreRowModel, 
  getExpandedRowModel, 
  ColumnDef, 
  flexRender,
  Row
} from '@tanstack/react-table';
import { 
  ChevronRight, ChevronDown, Package, Hammer, Wrench, 
  Save, Camera, History, ArrowUpRight, ArrowDownRight,
  TrendingUp, CircleDollarSign, Table as TableIcon
} from 'lucide-react';

// --- Helper Types for the Grid ---
type GridItemType = 'rubro' | 'task';

interface GridRow {
  id: string;
  type: GridItemType;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  originalItem?: any; // Reference to original BudgetItem or Task
  subRows?: GridRow[]; // For hierarchical structure
}

// --- Component ---
export const BudgetGrid: React.FC = () => {
  const { 
    project, tasks, materials, rubros,
    updateBudgetItem, addTaskYield, updateMaterial, snapshots, createSnapshot,
    addTaskToolYield, updateTool, updateTask,
    // Indexes
    yieldsIndex, materialsMap, toolYieldsIndex, toolsMap
  } = useERP();

  const [expanded, setExpanded] = useState({});

  // 1. Data Transformation: Flat List -> Hierarchical (Rubro -> Task)
  const data = useMemo(() => {
    const groups: Record<string, GridRow[]> = {};
    
    // Initialize groups for all rubros to ensure order
    rubros.forEach(r => groups[r] = []);
    groups['Sin Categoría'] = [];

    project.items.forEach(item => {
      const task = tasks.find(t => t.id === item.taskId);
      if (!task) return;

      const analysis = calculateUnitPrice(task, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap);
      const category = task.category && rubros.includes(task.category) ? task.category : 'Sin Categoría';
      
      const gridRow: GridRow = {
        id: item.id,
        type: 'task',
        name: task.name,
        unit: task.unit,
        quantity: item.quantity,
        unitPrice: analysis.totalUnitCost,
        totalPrice: analysis.totalUnitCost * item.quantity,
        originalItem: { ...item, taskData: task },
      };

      if (!groups[category]) groups[category] = [];
      groups[category].push(gridRow);
    });

    // Flatten to: Rubro Header -> Task Rows
    // In TanStack Table, we can use subRows for true tree structure.
    const result: GridRow[] = [];
    Object.keys(groups).forEach(rubro => {
      if (groups[rubro].length > 0) {
        const rubroTotal = groups[rubro].reduce((sum, row) => sum + row.totalPrice, 0);
        result.push({
          id: `RUBRO_${rubro}`,
          type: 'rubro',
          name: rubro,
          unit: '-',
          quantity: 0,
          unitPrice: 0,
          totalPrice: rubroTotal,
          subRows: groups[rubro]
        });
      }
    });

    return result;
  }, [project.items, tasks, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, rubros]);

  // 2. Total Project Cost Calculation
  const totalProjectCost = useMemo(() => 
    data.reduce((acc, curr) => acc + curr.totalPrice, 0), 
  [data]);

  // 3. Columns Definition
  const columns = useMemo<ColumnDef<GridRow>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Descripción / Ítem',
      cell: ({ row, getValue }) => {
        const isRubro = row.original.type === 'rubro';
        return (
          <div 
            className={`flex items-center gap-2 ${isRubro ? 'pl-2' : 'pl-8'}`}
            style={{ paddingLeft: `${row.depth * 20}px` }}
          >
            {row.getCanExpand() && (
              <button
                onClick={row.getToggleExpandedHandler()}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
              >
                {row.getIsExpanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            <span className={isRubro ? 'font-bold text-slate-800 uppercase text-xs tracking-wider' : 'font-medium text-slate-700 text-sm'}>
              {getValue() as string}
            </span>
            {!isRubro && row.original.type === 'task' && (
                <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 rounded border border-slate-200">
                    {row.original.originalItem.taskData.id.substring(0,6)}
                </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'unit',
      header: 'Unidad',
      cell: ({ row, getValue }) => (
        <span className="text-xs text-slate-500 font-medium">
            {row.original.type === 'rubro' ? '' : getValue() as string}
        </span>
      ),
      size: 80,
    },
    {
      accessorKey: 'quantity',
      header: 'Cantidad',
      cell: ({ row, getValue }) => {
        if (row.original.type === 'rubro') return null;
        
        // Inline Editing for Quantity
        return (
          <input
            type="number"
            className="w-20 text-right p-1.5 border border-slate-200 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium transition-all hover:border-slate-300"
            value={getValue() as number}
            onChange={(e) => {
               const val = parseFloat(e.target.value);
               if (!isNaN(val)) updateBudgetItem(row.original.id, { quantity: val });
            }}
          />
        );
      },
      size: 100,
    },
    {
      accessorKey: 'unitPrice',
      header: 'Precio Unitario',
      cell: ({ row, getValue }) => {
         if (row.original.type === 'rubro') return null;
         return (
             <span className="font-mono text-slate-600 text-sm">
                 ${(getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </span>
         );
      },
      size: 120,
    },
    {
      accessorKey: 'totalPrice',
      header: 'Subtotal',
      cell: ({ row, getValue }) => (
        <span className={`font-mono font-bold text-sm ${row.original.type === 'rubro' ? 'text-slate-800' : 'text-blue-600'}`}>
          ${(getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
      size: 120,
    },
  ], [updateBudgetItem]);

  const table = useReactTable({
    data,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  // --- Snapshot Logic ---
  const handleSnapshot = () => {
      const name = prompt("Nombre para la línea base (Snapshot):", `Linea Base ${snapshots.length + 1}`);
      if (name) {
          createSnapshot(name, totalProjectCost);
      }
  };

  const lastSnapshot = snapshots.length > 0 ? snapshots[0] : null;
  const deviation = lastSnapshot ? totalProjectCost - lastSnapshot.totalCost : 0;

  // --- Sub-Component: Resource Editor (The "Details" View) ---
  const renderResourceEditor = (row: Row<GridRow>) => {
      if (row.original.type !== 'task') return null;

      const task = row.original.originalItem.taskData;
      const taskId = task.id;

      // Get current resources linked to this task
      const taskMats = (yieldsIndex[taskId] || []).map(y => ({ ...y, detail: materialsMap[y.materialId] }));
      const taskTools = (toolYieldsIndex[taskId] || []).map(y => ({ ...y, detail: toolsMap[y.toolId] }));

      return (
          <div className="bg-slate-50 p-6 border-b border-slate-200 animate-in slide-in-from-top-2 duration-200 shadow-inner">
             <div className="flex items-center gap-2 mb-4">
                <Wrench size={16} className="text-slate-400" />
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest">Análisis de Recursos (APU) - {task.name}</h4>
             </div>
             
             <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm max-w-4xl">
                 <table className="w-full text-sm text-left">
                     <thead className="bg-slate-100 text-xs text-slate-500 font-semibold uppercase">
                         <tr>
                             <th className="p-3 pl-4">Recurso</th>
                             <th className="p-3">Categoría</th>
                             <th className="p-3 text-right">Rendimiento (Consumo)</th>
                             <th className="p-3 text-right">Costo Unit. (Base)</th>
                             <th className="p-3 text-right">Incidencia</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {/* Mano de Obra (Native Task prop) */}
                         <tr className="hover:bg-slate-50 group">
                             <td className="p-3 pl-4 flex items-center gap-2">
                                 <div className="p-1 bg-emerald-100 text-emerald-600 rounded"><Hammer size={14}/></div>
                                 <span className="font-medium text-slate-700">Mano de Obra Directa</span>
                             </td>
                             <td className="p-3 text-slate-500 text-xs">Labor</td>
                             <td className="p-3 text-right">
                                 {/* Yield Editing (Update Task) */}
                                 <div className="flex items-center justify-end gap-1">
                                    <input 
                                        type="number" 
                                        className="w-16 text-right p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white focus:ring-0 transition-all font-medium text-slate-700"
                                        value={task.dailyYield}
                                        onChange={(e) => updateTask(taskId, { dailyYield: parseFloat(e.target.value) })}
                                    />
                                    <span className="text-xs text-slate-400">u/día</span>
                                 </div>
                             </td>
                             <td className="p-3 text-right">
                                  {/* Cost Editing (Update Task) */}
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-xs text-slate-400">$</span>
                                    <input 
                                        type="number" 
                                        className="w-20 text-right p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white focus:ring-0 transition-all font-mono text-slate-600"
                                        value={task.laborCost}
                                        onChange={(e) => updateTask(taskId, { laborCost: parseFloat(e.target.value) })}
                                    />
                                 </div>
                             </td>
                             <td className="p-3 text-right font-mono font-bold text-slate-800">
                                 ${(task.laborCost || 0).toFixed(2)}
                             </td>
                         </tr>

                         {/* Materials */}
                         {taskMats.map((m) => (
                             <tr key={m.materialId} className="hover:bg-slate-50 group">
                                 <td className="p-3 pl-4 flex items-center gap-2">
                                     <div className="p-1 bg-blue-100 text-blue-600 rounded"><Package size={14}/></div>
                                     <span className="font-medium text-slate-700">{m.detail?.name}</span>
                                 </td>
                                 <td className="p-3 text-slate-500 text-xs">Material</td>
                                 <td className="p-3 text-right">
                                    {/* Yield Editing */}
                                    <div className="flex items-center justify-end gap-1">
                                        <input 
                                            type="number" 
                                            className="w-16 text-right p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white focus:ring-0 transition-all font-medium text-slate-700"
                                            value={m.quantity}
                                            onChange={(e) => addTaskYield({ taskId, materialId: m.materialId, quantity: parseFloat(e.target.value) })}
                                        />
                                        <span className="text-xs text-slate-400">{m.detail?.unit}</span>
                                    </div>
                                 </td>
                                 <td className="p-3 text-right">
                                    {/* Price Editing (Updates MASTER material price) */}
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-xs text-slate-400">$</span>
                                        <input 
                                            type="number" 
                                            className="w-20 text-right p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white focus:ring-0 transition-all font-mono text-slate-600"
                                            value={m.detail?.cost}
                                            onChange={(e) => m.detail && updateMaterial(m.detail.id, { cost: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                 </td>
                                 <td className="p-3 text-right font-mono font-bold text-slate-800">
                                     ${((m.detail?.cost || 0) * m.quantity).toFixed(2)}
                                 </td>
                             </tr>
                         ))}

                         {/* Tools */}
                         {taskTools.map((t) => (
                             <tr key={t.toolId} className="hover:bg-slate-50 group">
                                 <td className="p-3 pl-4 flex items-center gap-2">
                                     <div className="p-1 bg-purple-100 text-purple-600 rounded"><Wrench size={14}/></div>
                                     <span className="font-medium text-slate-700">{t.detail?.name}</span>
                                 </td>
                                 <td className="p-3 text-slate-500 text-xs">Equipo</td>
                                 <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <input 
                                            type="number" 
                                            className="w-16 text-right p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white focus:ring-0 transition-all font-medium text-slate-700"
                                            value={t.hoursPerUnit}
                                            onChange={(e) => addTaskToolYield({ taskId, toolId: t.toolId, hoursPerUnit: parseFloat(e.target.value) })}
                                        />
                                        <span className="text-xs text-slate-400">hs/u</span>
                                    </div>
                                 </td>
                                 <td className="p-3 text-right">
                                     <div className="flex items-center justify-end gap-1">
                                        <span className="text-xs text-slate-400">$</span>
                                        <input 
                                            type="number" 
                                            className="w-20 text-right p-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded bg-transparent focus:bg-white focus:ring-0 transition-all font-mono text-slate-600"
                                            value={t.detail?.costPerHour}
                                            onChange={(e) => t.detail && updateTool(t.detail.id, { costPerHour: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                 </td>
                                 <td className="p-3 text-right font-mono font-bold text-slate-800">
                                     ${((t.detail?.costPerHour || 0) * t.hoursPerUnit).toFixed(2)}
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
                 <div className="bg-slate-50 p-2 text-center border-t border-slate-200">
                     <p className="text-[10px] text-slate-400 italic">
                         Nota: La edición de precios base actualiza el catálogo global. La edición de consumo solo afecta a esta tarea.
                     </p>
                 </div>
             </div>
          </div>
      );
  };

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
         <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <TableIcon className="text-blue-600" /> Presupuesto Jerárquico
            </h2>
            <p className="text-sm text-slate-500">Edición en grilla con desglose de recursos y análisis de desvíos.</p>
         </div>
         
         {/* KPI & Actions */}
         <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
             <div className="px-4 border-r border-slate-200">
                 <p className="text-[10px] uppercase font-bold text-slate-400">Total Presupuesto</p>
                 <p className="text-xl font-mono font-bold text-slate-800">${totalProjectCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
             </div>
             
             {lastSnapshot && (
                 <div className="px-4 border-r border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">Vs. {lastSnapshot.name}</p>
                    <div className={`flex items-center gap-1 font-bold font-mono text-sm ${deviation > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {deviation > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        ${Math.abs(deviation).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                 </div>
             )}

             <button 
                onClick={handleSnapshot}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white hover:bg-black rounded-lg text-sm font-bold transition-all shadow-md"
                title="Guardar estado actual como Línea Base"
             >
                 <Camera size={16} /> Snapshot
             </button>
         </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
         <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
               {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                     {headerGroup.headers.map(header => (
                        <th key={header.id} className="p-4 border-b border-slate-200">
                           {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                     ))}
                  </tr>
               ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
               {table.getRowModel().rows.map(row => (
                  <Fragment key={row.id}>
                      <tr className={`hover:bg-blue-50/50 transition-colors ${row.original.type === 'rubro' ? 'bg-slate-50/50' : ''}`}>
                         {row.getVisibleCells().map(cell => (
                            <td key={cell.id} className="p-2 border-r border-transparent last:border-0">
                               {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                         ))}
                      </tr>
                      {/* Expanded Row Content */}
                      {row.getIsExpanded() && row.original.type === 'task' && (
                          <tr>
                              <td colSpan={columns.length} className="p-0">
                                  {renderResourceEditor(row)}
                              </td>
                          </tr>
                      )}
                  </Fragment>
               ))}
            </tbody>
            {/* Footer Summary */}
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                    <td className="p-4 font-bold text-slate-800 uppercase text-xs" colSpan={4}>Total General</td>
                    <td className="p-4 font-mono font-bold text-blue-600 text-lg">
                        ${totalProjectCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                </tr>
            </tfoot>
         </table>
      </div>

      {/* Snapshot History (Optional) */}
      {snapshots.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
             <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 mb-4">
                 <History size={16} /> Historial de Líneas Base
             </h3>
             <div className="flex gap-4 overflow-x-auto pb-2">
                 {snapshots.map(snap => (
                     <div key={snap.id} className="min-w-[200px] p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                         <div className="font-bold text-slate-800">{snap.name}</div>
                         <div className="text-xs text-slate-500 mb-2">{new Date(snap.date).toLocaleDateString()}</div>
                         <div className="font-mono font-bold text-slate-600">${snap.totalCost.toLocaleString()}</div>
                     </div>
                 ))}
             </div>
          </div>
      )}

    </div>
  );
};