import React, { useState, useMemo } from 'react';
import { ArrowRight, Trash2, Plus, AlertCircle, Link as LinkIcon, ArrowLeft } from 'lucide-react';
import { useERP } from '../context/ERPContext';
import { LinkType, ProjectDependency } from '../types';

interface TaskRelationsProps {
    taskId: string;
}

export const TaskRelations: React.FC<TaskRelationsProps> = ({ taskId }) => {
    const { project, tasks, addDependency, removeDependency, updateDependency } = useERP();
    
    // Local state for new dependency form
    const [newDepType, setNewDepType] = useState<LinkType>(LinkType.FS);
    const [newDepLag, setNewDepLag] = useState<number>(0);
    const [selectedTargetId, setSelectedTargetId] = useState<string>('');
    const [relationDirection, setRelationDirection] = useState<'predecessor' | 'successor'>('predecessor');

    // Helper to resolve names
    const getTaskDisplayName = (item: any) => {
        if (!item) return 'Tarea desconocida';
        const master = tasks.find(t => t.id === item.taskId);
        const name = item.name || master?.name || 'Sin nombre';
        const code = master?.code || '';
        return code ? `${code} - ${name}` : name;
    };

    const getTaskNameById = (id: string) => {
        const item = project.items.find(i => i.id === id);
        return getTaskDisplayName(item);
    };

    // Derived lists
    const allDependencies = useMemo(() => {
        if (project.dependencies && project.dependencies.length > 0) {
            return project.dependencies;
        }
        // Fallback extraction (Read-only view of legacy data if not migrated)
        const extracted: ProjectDependency[] = [];
        project.items.forEach(item => {
            if (item.dependencies) {
                item.dependencies.forEach(d => {
                    extracted.push({
                        id: `${item.id}-${d.predecessorId}`,
                        fromTaskId: d.predecessorId,
                        toTaskId: item.id,
                        type: d.type,
                        lag: d.lag
                    });
                });
            }
        });
        return extracted;
    }, [project.dependencies, project.items]);

    const predecessors = allDependencies.filter(d => d.toTaskId === taskId);
    const successors = allDependencies.filter(d => d.fromTaskId === taskId);

    // Available tasks for selection (exclude self and existing relations)
    const availableTasks = useMemo(() => {
        const existingIds = new Set([
            ...predecessors.map(d => d.fromTaskId),
            ...successors.map(d => d.toTaskId),
            taskId
        ]);
        
        return project.items
            .filter(i => !existingIds.has(i.id))
            .map(item => ({
                id: item.id,
                displayName: getTaskDisplayName(item)
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [project.items, predecessors, successors, taskId, tasks]);

    const handleAdd = () => {
        if (!selectedTargetId) return;

        const newDep: ProjectDependency = {
            id: crypto.randomUUID(),
            fromTaskId: relationDirection === 'predecessor' ? selectedTargetId : taskId,
            toTaskId: relationDirection === 'predecessor' ? taskId : selectedTargetId,
            type: newDepType,
            lag: Number(newDepLag),
            note: ''
        };

        addDependency(newDep);
        setSelectedTargetId('');
        setNewDepLag(0);
    };

    return (
        <div className="space-y-6 p-4">
            {/* Add New Relation */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Plus size={16} /> Nueva Relación
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Tarea Relacionada</label>
                        <select 
                            className="w-full text-sm border-slate-300 rounded-md p-2"
                            value={selectedTargetId}
                            onChange={e => setSelectedTargetId(e.target.value)}
                        >
                            <option value="">Seleccionar tarea...</option>
                            {availableTasks.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.displayName}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Tipo Relación</label>
                        <div className="flex bg-white rounded-md border border-slate-300 overflow-hidden">
                            <select 
                                className="w-full text-sm border-none p-2 focus:ring-0"
                                value={relationDirection}
                                onChange={e => setRelationDirection(e.target.value as any)}
                            >
                                <option value="predecessor">Predecesora (Es requisito para esta)</option>
                                <option value="successor">Sucesora (Depende de esta)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Tipo & Lag (días)</label>
                        <div className="flex gap-2">
                            <select 
                                className="text-sm border-slate-300 rounded-md p-2 w-20"
                                value={newDepType}
                                onChange={e => setNewDepType(e.target.value as LinkType)}
                            >
                                {Object.entries(LinkType).map(([key, value]) => (
                                    <option key={key} value={value}>{value}</option>
                                ))}
                            </select>
                            <input 
                                type="number" 
                                className="text-sm border-slate-300 rounded-md p-2 w-16"
                                value={newDepLag}
                                onChange={e => setNewDepLag(Number(e.target.value))}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <button 
                        className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                        onClick={handleAdd}
                        disabled={!selectedTargetId}
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {/* Predecessors List */}
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                    <ArrowLeft size={14} /> Predecesoras (Esta tarea depende de...)
                </h4>
                {predecessors.length === 0 ? (
                    <div className="text-sm text-slate-400 italic p-2 border border-dashed border-slate-200 rounded">No hay predecesoras definidas.</div>
                ) : (
                    <div className="space-y-2">
                        {predecessors.map(dep => (
                            <div key={dep.id} className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-100 text-orange-600 p-1.5 rounded">
                                        <LinkIcon size={14} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-800">{getTaskNameById(dep.fromTaskId)}</div>
                                        <div className="text-xs text-slate-500 flex gap-2">
                                            <span className="bg-slate-100 px-1 rounded">Tipo: {dep.type}</span>
                                            <span className="bg-slate-100 px-1 rounded">Lag: {dep.lag}d</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="text-xs border-slate-200 rounded p-1"
                                        value={dep.type}
                                        onChange={e => updateDependency(dep.id, { type: e.target.value as LinkType })}
                                    >
                                        {Object.entries(LinkType).map(([key, value]) => (
                                            <option key={key} value={value}>{value}</option>
                                        ))}
                                    </select>
                                    <input 
                                        type="number" 
                                        className="text-xs border-slate-200 rounded p-1 w-12"
                                        value={dep.lag}
                                        onChange={e => updateDependency(dep.id, { lag: Number(e.target.value) })}
                                    />
                                    <button 
                                        onClick={() => removeDependency(dep.id)}
                                        className="text-slate-400 hover:text-red-500 p-1"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Successors List */}
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                    <ArrowRight size={14} /> Sucesoras (Tareas que dependen de esta...)
                </h4>
                {successors.length === 0 ? (
                    <div className="text-sm text-slate-400 italic p-2 border border-dashed border-slate-200 rounded">No hay sucesoras definidas.</div>
                ) : (
                    <div className="space-y-2">
                        {successors.map(dep => (
                            <div key={dep.id} className="flex items-center justify-between bg-white p-3 rounded border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-100 text-blue-600 p-1.5 rounded">
                                        <LinkIcon size={14} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-800">{getTaskNameById(dep.toTaskId)}</div>
                                        <div className="text-xs text-slate-500 flex gap-2">
                                            <span className="bg-slate-100 px-1 rounded">Tipo: {dep.type}</span>
                                            <span className="bg-slate-100 px-1 rounded">Lag: {dep.lag}d</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="text-xs border-slate-200 rounded p-1"
                                        value={dep.type}
                                        onChange={e => updateDependency(dep.id, { type: e.target.value as LinkType })}
                                    >
                                        {Object.entries(LinkType).map(([key, value]) => (
                                            <option key={key} value={value}>{value}</option>
                                        ))}
                                    </select>
                                    <input 
                                        type="number" 
                                        className="text-xs border-slate-200 rounded p-1 w-12"
                                        value={dep.lag}
                                        onChange={e => updateDependency(dep.id, { lag: Number(e.target.value) })}
                                    />
                                    <button 
                                        onClick={() => removeDependency(dep.id)}
                                        className="text-slate-400 hover:text-red-500 p-1"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
