import React, { useState, useMemo } from 'react';
import { useERP } from '../context/ERPContext';
import { generateId } from '../utils/generateId';
import { useAuth } from '../context/AuthContext';
import { useProjectSchedule } from '../hooks/useProjectSchedule';
import {
  Users, UserPlus, FileSignature, ShieldCheck, BadgeAlert, Plus, Calendar,
  DollarSign, ArrowRight, CheckCircle2, AlertTriangle, FileText, Check, Save,
  HardHat, ClipboardCheck, History, Wallet
} from 'lucide-react';
import { Subcontractor, Contract, Certification, ContractItem } from '../types';

export const Subcontractors: React.FC = () => {
  const {
      subcontractors, contracts, certifications, project, tasks,
      addSubcontractor, updateSubcontractor, addContract, addCertification,
  } = useERP();

  const { itemCosts } = useProjectSchedule();

  const { user } = useAuth();
  const currentOrgId = user?.organizationId ?? '';

  const [activeView, setActiveView] = useState<'list' | 'contracts' | 'certify'>('list');

  // --- STATE FOR NEW SUBCONTRACTOR ---
  const [newSub, setNewSub] = useState<Partial<Subcontractor>>({
      name: '', cuit: '', category: '', documents: []
  });
  const [showAddSub, setShowAddSub] = useState(false);

  // --- STATE FOR NEW CONTRACT ---
  const [newContract, setNewContract] = useState<{
      subId: string;
      desc: string;
      retention: number;
      selectedItems: Set<string>;
  }>({ subId: '', desc: '', retention: 5, selectedItems: new Set() });
  const [showAddContract, setShowAddContract] = useState(false);

  // --- STATE FOR CERTIFICATION ---
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [certPeriod, setCertPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [currentCertValues, setCurrentCertValues] = useState<Record<string, number>>({});

  // --- HELPERS ---
  const checkDocsStatus = (sub: Subcontractor) => {
      const now = new Date();
      const hasArt = sub.documents.find(d => d.type === 'ART' && new Date(d.expirationDate) > now);
      const hasVida = sub.documents.find(d => d.type === 'VIDA' && new Date(d.expirationDate) > now);
      return { ok: !!(hasArt && hasVida), hasArt: !!hasArt, hasVida: !!hasVida };
  };

  const getContractProgress = (contractId: string) => {
      const certs = certifications.filter(c => c.contractId === contractId);
      let totalPaid = 0;
      let totalRetention = 0;
      certs.forEach(c => {
          totalPaid += c.totalNet;
          totalRetention += c.retentionAmount;
      });
      return { totalPaid, totalRetention, count: certs.length };
  };

  /**
   * Devuelve el porcentaje acumulado certificado por budgetItemId para un contrato dado.
   * Usado para validar el cap del 100% antes de emitir una nueva certificación.
   */
  const getAccumulatedPctByItem = (contractId: string): Record<string, number> => {
      const acc: Record<string, number> = {};
      certifications
        .filter(c => c.contractId === contractId)
        .forEach(cert => {
          cert.items.forEach(ci => {
            acc[ci.contractItemId] = (acc[ci.contractItemId] ?? 0) + ci.percentageThisPeriod;
          });
        });
      return acc;
  };

  // --- HANDLERS ---
  const handleSaveSub = () => {
      if (!newSub.name || !newSub.cuit) return;
      // Documentos vacíos: el usuario debe cargar los certificados reales (ART, Vida, etc.)
      addSubcontractor({
          id: generateId(),
          organizationId: currentOrgId,
          name: newSub.name,
          cuit: newSub.cuit,
          category: newSub.category || 'General',
          documents: [],
          phone: newSub.phone,
          email: newSub.email
      });
      setShowAddSub(false);
      setNewSub({ name: '', cuit: '', category: '', documents: [] });
  };

  const handleSaveContract = () => {
      if (!newContract.subId || newContract.selectedItems.size === 0) return;

      const contractItems: ContractItem[] = [];
      newContract.selectedItems.forEach(bid => {
          const bItem = project.items.find(i => i.id === bid);
          if (bItem) {
              const unitPrice = itemCosts.find(c => c.id === bid)?.unitCost ?? 0;
              contractItems.push({
                  budgetItemId: bid,
                  taskId: bItem.taskId,
                  agreedUnitPrice: unitPrice
              });
          }
      });

      addContract({
          id: generateId(),
          organizationId: currentOrgId,
          projectId: project.id,
          subcontractorId: newContract.subId,
          description: newContract.desc,
          startDate: new Date().toISOString(),
          retentionPercent: newContract.retention,
          status: 'active',
          items: contractItems
      });
      setShowAddContract(false);
      setActiveView('contracts');
  };

  const handleCertify = () => {
      if (!selectedContractId) return;
      const contract = contracts.find(c => c.id === selectedContractId);
      if (!contract) return;

      // Validar cap acumulado: ningún ítem puede superar el 100% entre todos los períodos
      const prevPct = getAccumulatedPctByItem(selectedContractId);
      const overflowItem = contract.items.find(ci => {
        const prev = prevPct[ci.budgetItemId] ?? 0;
        const thisPeriod = currentCertValues[ci.budgetItemId] ?? 0;
        return prev + thisPeriod > 100;
      });

      if (overflowItem) {
        const bItem = project.items.find(i => i.id === overflowItem.budgetItemId);
        const t = tasks.find(tsk => tsk.id === bItem?.taskId);
        const label = t?.name ?? overflowItem.budgetItemId;
        // TODO: reemplazar este alert con un modal de React en el Sprint siguiente
        alert(`Error: el ítem "${label}" superaría el 100% de certificación acumulada. Ajustá los porcentajes antes de continuar.`);
        return;
      }

      let gross = 0;
      const certItems = contract.items.map(ci => {
          const val = currentCertValues[ci.budgetItemId] || 0;
          const bItem = project.items.find(i => i.id === ci.budgetItemId);
          if (!bItem) return null;
          const amount = (val / 100) * (bItem.quantity * ci.agreedUnitPrice);
          gross += amount;
          return {
              contractItemId: ci.budgetItemId, // ID real del ítem de presupuesto
              percentageThisPeriod: val,
              amountThisPeriod: amount
          };
      }).filter(Boolean) as any[];

      const retention = gross * (contract.retentionPercent / 100);
      const net = gross - retention;

      addCertification({
          id: generateId(),
          organizationId: currentOrgId,
          contractId: contract.id,
          date: new Date().toISOString(),
          period: certPeriod,
          items: certItems,
          totalGross: gross,
          retentionAmount: retention,
          totalNet: net,
          status: 'approved'
      });

      setActiveView('contracts');
      setSelectedContractId('');
      setCurrentCertValues({});
  };

  // --- RENDER HELPERS ---
  const renderDocsStatus = (sub: Subcontractor) => {
      const status = checkDocsStatus(sub);
      if (status.ok) {
          return <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100"><ShieldCheck size={14}/> Habilitado</span>;
      }
      return (
          <span className="flex items-center gap-1 text-red-600 text-xs font-bold bg-red-50 px-2 py-1 rounded-full border border-red-100" title="Falta ART o Seguro de Vida vigente">
              <BadgeAlert size={14}/> Inhabilitado
          </span>
      );
  };

  return (
    <div className="space-y-6 pb-20">

      {/* Header Tabs */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 flex gap-2">
          <button
            onClick={() => setActiveView('list')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeView === 'list' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
              <Users size={18} /> Subcontratistas
          </button>
          <button
            onClick={() => setActiveView('contracts')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeView === 'contracts' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
              <FileSignature size={18} /> Contratos
          </button>
          <button
            onClick={() => setActiveView('certify')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all ${activeView === 'certify' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
          >
              <ClipboardCheck size={18} /> Certificar Mes
          </button>
      </div>

      {/* VIEW: SUBCONTRACTORS LIST */}
      {activeView === 'list' && (
          <div className="space-y-4">
              <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-700">Directorio de Proveedores</h3>
                  <button onClick={() => setShowAddSub(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                      <UserPlus size={16} /> Nuevo
                  </button>
              </div>

              {showAddSub && (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in">
                      <input placeholder="Razón Social" className="p-2 border rounded" value={newSub.name} onChange={e => setNewSub({...newSub, name: e.target.value})} />
                      <input placeholder="CUIT" className="p-2 border rounded" value={newSub.cuit} onChange={e => setNewSub({...newSub, cuit: e.target.value})} />
                      <input placeholder="Rubro (Ej: Electricidad)" className="p-2 border rounded" value={newSub.category} onChange={e => setNewSub({...newSub, category: e.target.value})} />
                      <button onClick={handleSaveSub} className="bg-blue-600 text-white rounded font-bold">Guardar</button>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subcontractors.map(sub => (
                      <div key={sub.id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <h4 className="font-bold text-slate-800">{sub.name}</h4>
                                  <p className="text-xs text-slate-500 font-mono">{sub.cuit}</p>
                              </div>
                              {renderDocsStatus(sub)}
                          </div>
                          <div className="text-sm text-slate-600 mb-4 flex items-center gap-2">
                              <HardHat size={14} className="text-slate-400" /> {sub.category}
                          </div>

                          <div className="pt-3 border-t border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Documentación</p>
                              {sub.documents.length === 0 ? (
                                  <p className="text-xs text-amber-600 italic">Sin documentos cargados</p>
                              ) : (
                                  <div className="space-y-1">
                                      {sub.documents.map(d => (
                                          <div key={d.id} className="flex justify-between text-xs">
                                              <span className="text-slate-600">{d.type}</span>
                                              <span className={`${new Date(d.expirationDate) < new Date() ? 'text-red-500 font-bold' : 'text-emerald-600'}`}>
                                                  Vence: {new Date(d.expirationDate).toLocaleDateString()}
                                              </span>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* VIEW: CONTRACTS */}
      {activeView === 'contracts' && (
          <div className="space-y-4">
              {!showAddContract ? (
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Contratos Activos</h3>
                    <button onClick={() => setShowAddContract(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                        <Plus size={16} /> Nuevo Contrato
                    </button>
                  </div>
              ) : (
                  <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm animate-in slide-in-from-right">
                      <h4 className="font-bold text-lg mb-4 text-slate-800">Redactar Contrato</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Subcontratista</label>
                              <select className="w-full p-2 border rounded" value={newContract.subId} onChange={e => setNewContract({...newContract, subId: e.target.value})}>
                                  <option value="">Seleccionar...</option>
                                  {subcontractors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Descripción Corta</label>
                              <input className="w-full p-2 border rounded" placeholder="Ej: Obra Gruesa Torre A" value={newContract.desc} onChange={e => setNewContract({...newContract, desc: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Fondo de Reparo (%)</label>
                              <input type="number" className="w-full p-2 border rounded" value={newContract.retention} onChange={e => setNewContract({...newContract, retention: parseFloat(e.target.value)})} />
                          </div>
                      </div>

                      <div className="mb-6">
                          <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Asignar Tareas del Presupuesto</label>
                          <div className="max-h-60 overflow-y-auto border rounded p-2 bg-slate-50">
                              {project.items.map(item => {
                                  const t = tasks.find(tsk => tsk.id === item.taskId);
                                  const unitPrice = itemCosts.find(c => c.id === item.id)?.unitCost ?? 0;
                                  return (
                                      <div key={item.id} className="flex items-center gap-2 py-1 border-b border-slate-200 last:border-0">
                                          <input
                                            type="checkbox"
                                            checked={newContract.selectedItems.has(item.id)}
                                            onChange={() => {
                                                const newSet = new Set(newContract.selectedItems);
                                                if (newSet.has(item.id)) newSet.delete(item.id); else newSet.add(item.id);
                                                setNewContract({...newContract, selectedItems: newSet});
                                            }}
                                          />
                                          <div className="flex-1 flex justify-between items-center pr-2">
                                              <span className="text-sm font-medium text-slate-700">{t?.name}</span>
                                              <div className="text-right">
                                                  <span className="text-xs text-slate-400 mr-2">{item.quantity} {t?.unit}</span>
                                                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                      ${unitPrice.toFixed(2)}
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      <div className="flex justify-end gap-2">
                          <button onClick={() => setShowAddContract(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded">Cancelar</button>
                          <button onClick={handleSaveContract} className="px-6 py-2 bg-slate-900 text-white font-bold rounded shadow-lg hover:bg-black">Crear Contrato</button>
                      </div>
                  </div>
              )}

              <div className="space-y-4">
                  {contracts.map(c => {
                      const sub = subcontractors.find(s => s.id === c.subcontractorId);
                      const progress = getContractProgress(c.id);
                      return (
                          <div key={c.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <h4 className="font-bold text-lg text-slate-800">{sub?.name}</h4>
                                      <p className="text-sm text-slate-500">{c.description}</p>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-xs font-bold text-slate-400 uppercase">Fondo Reparo Acumulado</div>
                                      <div className="text-lg font-mono font-bold text-blue-600 flex items-center justify-end gap-1">
                                          <Wallet size={16} /> ${progress.totalRetention.toLocaleString()}
                                      </div>
                                  </div>
                              </div>

                              <div className="grid grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                                  <div>
                                      <span className="block text-slate-400 text-xs">Inicio</span>
                                      <span className="font-bold text-slate-700">{new Date(c.startDate).toLocaleDateString()}</span>
                                  </div>
                                  <div>
                                      <span className="block text-slate-400 text-xs">Retención</span>
                                      <span className="font-bold text-slate-700">{c.retentionPercent}%</span>
                                  </div>
                                  <div>
                                      <span className="block text-slate-400 text-xs">Total Pagado</span>
                                      <span className="font-bold text-emerald-600">${progress.totalPaid.toLocaleString()}</span>
                                  </div>
                              </div>

                              <div className="mt-4 flex gap-2">
                                  <button
                                    onClick={() => { setSelectedContractId(c.id); setActiveView('certify'); }}
                                    className="text-xs font-bold bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded hover:bg-emerald-50 flex items-center gap-1"
                                  >
                                      <ClipboardCheck size={14} /> Certificar
                                  </button>
                                  <button className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 flex items-center gap-1">
                                      <History size={14} /> Ver Historial
                                  </button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* VIEW: CERTIFICATION */}
      {activeView === 'certify' && (
          <div className="animate-in fade-in">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                 <ClipboardCheck className="text-emerald-600" /> Nueva Certificación
              </h3>

              {!selectedContractId ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                      <p className="text-slate-400 mb-4">Seleccione un contrato para iniciar el proceso de certificación mensual.</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                          {contracts.map(c => {
                              const sub = subcontractors.find(s => s.id === c.subcontractorId);
                              return (
                                  <button
                                    key={c.id}
                                    onClick={() => setSelectedContractId(c.id)}
                                    className="bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm hover:border-blue-300 hover:text-blue-600 font-bold text-sm transition-all"
                                  >
                                      {sub?.name} - {c.description}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              ) : (
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                      {(() => {
                          const contract = contracts.find(c => c.id === selectedContractId);
                          const sub = subcontractors.find(s => s.id === contract?.subcontractorId);
                          const docsStatus = sub ? checkDocsStatus(sub) : { ok: false };
                          const prevPct = getAccumulatedPctByItem(selectedContractId);

                          if (!contract || !sub) return null;

                          return (
                              <>
                                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
                                      <div>
                                          <h2 className="text-xl font-bold text-slate-800">{sub.name}</h2>
                                          <p className="text-sm text-slate-500">Certificación Período: {certPeriod}</p>
                                      </div>

                                      <div className="flex flex-col items-end gap-2">
                                          <input
                                            type="month"
                                            className="p-2 border border-slate-300 rounded text-sm font-bold"
                                            value={certPeriod}
                                            onChange={e => setCertPeriod(e.target.value)}
                                          />
                                          {!docsStatus.ok && (
                                              <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-100 px-3 py-1.5 rounded-full animate-pulse">
                                                  <BadgeAlert size={16} /> Documentación Vencida
                                              </div>
                                          )}
                                      </div>
                                  </div>

                                  <div className="p-6 overflow-x-auto">
                                      <table className="w-full text-left text-sm">
                                          <thead className="text-xs uppercase text-slate-500 border-b border-slate-200">
                                              <tr>
                                                  <th className="pb-3">Ítem</th>
                                                  <th className="pb-3 text-right">Cant. Total</th>
                                                  <th className="pb-3 text-right">Precio Pactado</th>
                                                  <th className="pb-3 text-right text-slate-400">% Certif. Anterior</th>
                                                  <th className="pb-3 text-right text-emerald-600 w-32">% Avance Mes</th>
                                                  <th className="pb-3 text-right">Monto a Certificar</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                              {contract.items.map(ci => {
                                                  const bItem = project.items.find(i => i.id === ci.budgetItemId);
                                                  const t = tasks.find(tsk => tsk.id === ci.taskId);
                                                  const currentVal = currentCertValues[ci.budgetItemId] || 0;
                                                  const amount = (currentVal / 100) * (bItem ? bItem.quantity * ci.agreedUnitPrice : 0);
                                                  const previousPct = prevPct[ci.budgetItemId] ?? 0;
                                                  const remaining = Math.max(0, 100 - previousPct);
                                                  const isOverflow = previousPct + currentVal > 100;

                                                  return (
                                                      <tr key={ci.budgetItemId} className={`hover:bg-slate-50 ${isOverflow ? 'bg-red-50' : ''}`}>
                                                          <td className="py-3 font-medium text-slate-700">{t?.name}</td>
                                                          <td className="py-3 text-right text-slate-500">{bItem?.quantity} {t?.unit}</td>
                                                          <td className="py-3 text-right font-mono">${ci.agreedUnitPrice.toFixed(2)}</td>
                                                          <td className="py-3 text-right text-slate-400 text-xs font-mono">
                                                            {previousPct.toFixed(1)}%
                                                          </td>
                                                          <td className="py-3 text-right">
                                                              <div className="flex items-center justify-end gap-1">
                                                                  <input
                                                                    type="number" min="0" max={remaining}
                                                                    className={`w-16 p-1 text-right border rounded focus:outline-none font-bold ${isOverflow ? 'border-red-400 focus:border-red-500 bg-red-50' : 'border-slate-300 focus:border-emerald-500'}`}
                                                                    value={currentVal}
                                                                    onChange={e => setCurrentCertValues({...currentCertValues, [ci.budgetItemId]: parseFloat(e.target.value) || 0})}
                                                                  />
                                                                  <span className="text-slate-400">%</span>
                                                              </div>
                                                              {isOverflow && (
                                                                <p className="text-red-500 text-[10px] text-right mt-0.5">Máx: {remaining}%</p>
                                                              )}
                                                          </td>
                                                          <td className="py-3 text-right font-bold text-slate-800">
                                                              ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                          </td>
                                                      </tr>
                                                  );
                                              })}
                                          </tbody>
                                      </table>
                                  </div>

                                  <div className="p-6 bg-slate-50 border-t border-slate-200">
                                      <div className="flex flex-col items-end gap-2">
                                          {(() => {
                                              let totalGross = 0;
                                              contract.items.forEach(ci => {
                                                  const bItem = project.items.find(i => i.id === ci.budgetItemId);
                                                  const val = currentCertValues[ci.budgetItemId] || 0;
                                                  if(bItem) totalGross += (val/100) * (bItem.quantity * ci.agreedUnitPrice);
                                              });
                                              const retention = totalGross * (contract.retentionPercent / 100);
                                              const net = totalGross - retention;
                                              const hasOverflow = contract.items.some(ci => {
                                                  const prev = prevPct[ci.budgetItemId] ?? 0;
                                                  return prev + (currentCertValues[ci.budgetItemId] ?? 0) > 100;
                                              });

                                              return (
                                                  <>
                                                      <div className="flex justify-between w-64 text-slate-500">
                                                          <span>Subtotal Bruto</span>
                                                          <span>${totalGross.toLocaleString()}</span>
                                                      </div>
                                                      <div className="flex justify-between w-64 text-red-500 text-sm">
                                                          <span>Fondo Reparo ({contract.retentionPercent}%)</span>
                                                          <span>-${retention.toLocaleString()}</span>
                                                      </div>
                                                      <div className="w-64 h-px bg-slate-300 my-1"></div>
                                                      <div className="flex justify-between w-64 text-xl font-bold text-slate-900">
                                                          <span>A PAGAR</span>
                                                          <span>${net.toLocaleString()}</span>
                                                      </div>

                                                      <button
                                                          onClick={handleCertify}
                                                          disabled={!docsStatus.ok || totalGross === 0 || hasOverflow}
                                                          className="mt-4 w-64 bg-emerald-600 text-white py-3 rounded-lg font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2"
                                                      >
                                                          {!docsStatus.ok ? <><AlertTriangle size={18}/> Docs Vencidos</>
                                                          : hasOverflow ? <><AlertTriangle size={18}/> Supera 100%</>
                                                          : <><CheckCircle2 size={18}/> Emitir Certificado</>}
                                                      </button>
                                                  </>
                                              );
                                          })()}
                                      </div>
                                  </div>
                              </>
                          );
                      })()}
                  </div>
              )}
          </div>
      )}

    </div>
  );
};
