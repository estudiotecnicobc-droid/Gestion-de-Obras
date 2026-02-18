import React, { useState, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, FileText, 
  Plus, Search, Filter, Camera, ArrowRight, BarChart2, ShieldAlert
} from 'lucide-react';
import { QualityInspection, NonConformity, QualityProtocol, ControlType } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export const QualityControl: React.FC = () => {
  const { 
    project, tasks, qualityProtocols, qualityInspections, nonConformities, 
    addQualityInspection, addNonConformity, updateNonConformity 
  } = useERP();
  const { user } = useAuth();

  const [view, setView] = useState<'dashboard' | 'inspections' | 'new-inspection' | 'non-conformities'>('dashboard');
  const [selectedTaskForInspection, setSelectedTaskForInspection] = useState<string>('');
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>('');
  const [inspectionDraft, setInspectionDraft] = useState<Partial<QualityInspection>>({});
  const [checkResults, setCheckResults] = useState<Record<string, any>>({}); // checkId -> value

  // --- Statistics ---
  const stats = useMemo(() => {
      const total = qualityInspections.length;
      const passed = qualityInspections.filter(i => i.status === 'passed').length;
      const failed = qualityInspections.filter(i => i.status === 'failed').length;
      const conditional = qualityInspections.filter(i => i.status === 'conditional').length;
      
      const openNC = nonConformities.filter(n => n.status === 'open');
      const criticalNC = openNC.filter(n => n.severity === 'critical').length;

      return { total, passed, failed, conditional, openNC: openNC.length, criticalNC };
  }, [qualityInspections, nonConformities]);

  const chartData = [
      { name: 'Aprobado', value: stats.passed, color: '#10b981' },
      { name: 'Rechazado', value: stats.failed, color: '#ef4444' },
      { name: 'Condicional', value: stats.conditional, color: '#f59e0b' }
  ];

  // --- Handlers ---

  const handleStartInspection = () => {
      if (!selectedTaskForInspection || !selectedProtocolId) return;
      const protocol = qualityProtocols.find(p => p.id === selectedProtocolId);
      if (!protocol) return;

      // Initialize results with defaults or empty
      const initialResults: Record<string, any> = {};
      protocol.checks.forEach(check => {
          if (check.type === 'attribute') initialResults[check.id] = false;
          else initialResults[check.id] = '';
      });

      setCheckResults(initialResults);
      setView('new-inspection');
  };

  const handleSubmitInspection = () => {
      if (!selectedTaskForInspection || !selectedProtocolId) return;
      
      // Determine overall status based on results logic (simplified: if any attribute failed => failed)
      const protocol = qualityProtocols.find(p => p.id === selectedProtocolId);
      let status: 'passed' | 'failed' | 'conditional' = 'passed';
      
      // Simple Logic: If any attribute check is false, Fail.
      // If variable check is empty, Conditional? (For now, strict fail if missing data, else pass)
      if (protocol) {
          const hasFailure = protocol.checks.some(c => {
              if (c.type === 'attribute' && checkResults[c.id] === false) return true;
              return false;
          });
          if (hasFailure) status = 'failed';
      }

      const newInspection: QualityInspection = {
          id: crypto.randomUUID(),
          organizationId: user?.organizationId || 'org_a',
          projectId: project.id,
          taskId: selectedTaskForInspection, // Currently BudgetItem ID in context of page, but ideally taskId reference
          protocolId: selectedProtocolId,
          date: new Date().toISOString(),
          inspector: user?.name || 'Inspector',
          status: status,
          results: checkResults,
          comments: inspectionDraft.comments
      };

      addQualityInspection(newInspection);

      // If Failed, auto-prompt for Non-Conformity creation?
      if (status === 'failed') {
          if(confirm('La inspección resultó "Rechazada". ¿Desea abrir una No Conformidad ahora?')) {
              const nc: NonConformity = {
                  id: crypto.randomUUID(),
                  organizationId: user?.organizationId || 'org_a',
                  projectId: project.id,
                  inspectionId: newInspection.id,
                  date: new Date().toISOString(),
                  description: `Fallo en inspección de ${protocol?.name}`,
                  severity: 'major',
                  correctiveAction: '',
                  status: 'open'
              };
              addNonConformity(nc);
          }
      }

      // Reset
      setView('inspections');
      setSelectedTaskForInspection('');
      setSelectedProtocolId('');
      setCheckResults({});
  };

  const getTaskName = (itemId: string) => {
      const item = project.items.find(i => i.id === itemId);
      const task = tasks.find(t => t.id === item?.taskId);
      return task?.name || 'Tarea Desconocida';
  };

  const getProtocolName = (id: string) => qualityProtocols.find(p => p.id === id)?.name || 'Protocolo';

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
        
        {/* Header Tabs */}
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-2">
            <button 
                onClick={() => setView('dashboard')}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${view === 'dashboard' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <BarChart2 size={18} /> Tablero
            </button>
            <button 
                onClick={() => setView('inspections')}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${view === 'inspections' || view === 'new-inspection' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <ClipboardCheck size={18} /> Inspecciones
            </button>
            <button 
                onClick={() => setView('non-conformities')}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${view === 'non-conformities' ? 'bg-red-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <ShieldAlert size={18} /> No Conformidades
            </button>
        </div>

        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-emerald-500" /> Estado de Inspecciones
                    </h3>
                    <div className="flex items-center">
                        <div className="h-48 w-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={chartData} innerRadius={35} outerRadius={60} paddingAngle={5} dataKey="value">
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="ml-6 space-y-2 text-sm">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div> Aprobado ({stats.passed})</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Rechazado ({stats.failed})</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-full"></div> Condicional ({stats.conditional})</div>
                            <div className="font-bold pt-2 border-t mt-2">Total: {stats.total}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-red-50 p-6 rounded-xl border border-red-100 shadow-sm flex flex-col justify-center">
                    <div className="text-red-500 font-bold uppercase text-xs mb-2">No Conformidades Abiertas</div>
                    <div className="text-4xl font-black text-red-700">{stats.openNC}</div>
                    <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle size={14}/> {stats.criticalNC} Críticas
                    </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-center">
                    <div className="text-blue-500 font-bold uppercase text-xs mb-2">Próximos Controles</div>
                    <div className="text-sm text-blue-800 font-medium">
                        Hormigonado Losa 2º Piso
                    </div>
                    <div className="text-xs text-blue-400 mt-1">Programado: 25/10/2023</div>
                    <button className="mt-4 text-xs bg-blue-200 text-blue-800 py-1 px-2 rounded hover:bg-blue-300 font-bold w-fit">Ver Planificación</button>
                </div>
            </div>
        )}

        {/* VIEW: INSPECTIONS LIST & FORM */}
        {(view === 'inspections' || view === 'new-inspection') && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {view === 'inspections' ? (
                    <>
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Registro de Control de Producción</h3>
                            <button 
                                onClick={() => setView('new-inspection')}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                            >
                                <Plus size={16} /> Nueva Inspección
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 text-slate-500 uppercase text-xs">
                                    <tr>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3">Tarea / Elemento</th>
                                        <th className="p-3">Protocolo</th>
                                        <th className="p-3">Inspector</th>
                                        <th className="p-3 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {qualityInspections.length === 0 && (
                                        <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin inspecciones registradas.</td></tr>
                                    )}
                                    {qualityInspections.map(ins => (
                                        <tr key={ins.id} className="hover:bg-slate-50">
                                            <td className="p-3">{new Date(ins.date).toLocaleDateString()}</td>
                                            <td className="p-3 font-medium">{getTaskName(ins.taskId)}</td>
                                            <td className="p-3 text-slate-500">{getProtocolName(ins.protocolId)}</td>
                                            <td className="p-3 text-slate-500">{ins.inspector}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${ins.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : ins.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {ins.status === 'passed' ? 'Aprobado' : ins.status === 'failed' ? 'Rechazado' : 'Condicional'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    // FORM NEW INSPECTION
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50">
                            <button onClick={() => setView('inspections')} className="text-slate-400 hover:text-slate-600 font-bold text-xs uppercase">Cancelar</button>
                            <h3 className="font-bold text-slate-800">Nueva Inspección de Calidad</h3>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Selector Section */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tarea a Inspeccionar</label>
                                    <select 
                                        className="w-full p-2 border border-slate-300 rounded"
                                        value={selectedTaskForInspection}
                                        onChange={e => { setSelectedTaskForInspection(e.target.value); setSelectedProtocolId(''); }}
                                    >
                                        <option value="">Seleccionar Tarea...</option>
                                        {project.items.map(item => {
                                            const t = tasks.find(tsk => tsk.id === item.taskId);
                                            return <option key={item.id} value={item.id}>{t?.name}</option>;
                                        })}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Protocolo de Control</label>
                                    <select 
                                        className="w-full p-2 border border-slate-300 rounded"
                                        value={selectedProtocolId}
                                        onChange={e => setSelectedProtocolId(e.target.value)}
                                        disabled={!selectedTaskForInspection}
                                    >
                                        <option value="">Seleccionar Protocolo...</option>
                                        {qualityProtocols.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedProtocolId && (
                                    <button 
                                        onClick={handleStartInspection}
                                        className="w-full bg-slate-800 text-white py-2 rounded font-bold"
                                    >
                                        Iniciar Lista de Chequeo
                                    </button>
                                )}
                            </div>

                            {/* Checklist Section */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                {selectedProtocolId && Object.keys(checkResults).length > 0 ? (
                                    <div className="space-y-4">
                                        {qualityProtocols.find(p => p.id === selectedProtocolId)?.checks.map(check => (
                                            <div key={check.id} className="bg-white p-3 rounded border border-slate-200">
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-bold text-sm text-slate-700">{check.description}</span>
                                                    <span className="text-xs text-slate-400 italic">{check.acceptanceCriteria}</span>
                                                </div>
                                                
                                                {check.type === 'attribute' ? (
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => setCheckResults({...checkResults, [check.id]: true})}
                                                            className={`flex-1 py-1 text-xs font-bold rounded border ${checkResults[check.id] === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-300'}`}
                                                        >
                                                            CUMPLE
                                                        </button>
                                                        <button 
                                                            onClick={() => setCheckResults({...checkResults, [check.id]: false})}
                                                            className={`flex-1 py-1 text-xs font-bold rounded border ${checkResults[check.id] === false ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-500 border-slate-300'}`}
                                                        >
                                                            NO CUMPLE
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="number" 
                                                            placeholder="Valor medido"
                                                            className="flex-1 p-1 border rounded text-sm"
                                                            value={checkResults[check.id]}
                                                            onChange={e => setCheckResults({...checkResults, [check.id]: parseFloat(e.target.value)})}
                                                        />
                                                        <span className="text-xs font-bold text-slate-500">{check.unit}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observaciones</label>
                                            <textarea 
                                                className="w-full p-2 border rounded text-sm"
                                                rows={3}
                                                value={inspectionDraft.comments || ''}
                                                onChange={e => setInspectionDraft({...inspectionDraft, comments: e.target.value})}
                                            />
                                        </div>

                                        <button 
                                            onClick={handleSubmitInspection}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-md"
                                        >
                                            Finalizar Inspección
                                        </button>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                                        Seleccione tarea y protocolo para ver la lista de chequeo.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* VIEW: NON CONFORMITIES */}
        {view === 'non-conformities' && (
            <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
                    <AlertTriangle className="text-red-500 mt-1" />
                    <div>
                        <h3 className="font-bold text-red-800">Gestión de No Conformidades</h3>
                        <p className="text-sm text-red-600">Registro y seguimiento de desviaciones críticas que requieren acción correctiva.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nonConformities.map(nc => (
                        <div key={nc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative">
                            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${nc.severity === 'critical' ? 'bg-red-600' : nc.severity === 'major' ? 'bg-orange-500' : 'bg-yellow-400'}`}></div>
                            <div className="pl-3">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${nc.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {nc.status === 'open' ? 'ABIERTA' : 'CERRADA'}
                                    </span>
                                    <span className="text-xs text-slate-400">{new Date(nc.date).toLocaleDateString()}</span>
                                </div>
                                <h4 className="font-bold text-slate-800 text-sm mb-1">{nc.description}</h4>
                                <div className="text-xs text-slate-500 mb-3">Severidad: <span className="font-bold uppercase">{nc.severity}</span></div>
                                
                                {nc.status === 'open' && (
                                    <div className="mt-2 pt-2 border-t border-slate-100">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Acción Correctiva</label>
                                        <textarea 
                                            className="w-full p-1 text-xs border rounded mt-1 bg-slate-50"
                                            placeholder="Describir solución..."
                                            value={nc.correctiveAction}
                                            onChange={e => updateNonConformity(nc.id, { correctiveAction: e.target.value })}
                                        />
                                        <button 
                                            onClick={() => updateNonConformity(nc.id, { status: 'closed' })}
                                            disabled={!nc.correctiveAction}
                                            className="mt-2 w-full bg-slate-800 text-white text-xs font-bold py-1.5 rounded disabled:opacity-50"
                                        >
                                            Cerrar No Conformidad
                                        </button>
                                    </div>
                                )}
                                {nc.status === 'closed' && (
                                    <div className="mt-2 text-xs bg-slate-50 p-2 rounded text-slate-600">
                                        <strong>Solución:</strong> {nc.correctiveAction}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

    </div>
  );
};