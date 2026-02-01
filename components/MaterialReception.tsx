import React, { useState, useMemo, useRef } from 'react';
import { useERP } from '../context/ERPContext';
import { Truck, Camera, Search, Plus, CheckCircle, AlertTriangle, Package, ChevronRight, X, Image as ImageIcon, ClipboardList, ArrowLeft } from 'lucide-react';
import { Reception, ReceptionItem, Material } from '../types';

export const MaterialReception: React.FC = () => {
  const { project, getProjectStockStatus, addReception, receptions, materials } = useERP();
  
  const [view, setView] = useState<'list' | 'new'>('list');
  const [stockStatus, setStockStatus] = useState(getProjectStockStatus());
  
  // Form State
  const [remitoNumber, setRemitoNumber] = useState('');
  const [provider, setProvider] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<ReceptionItem[]>([]);
  
  // Material Picker State
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  
  // Camera Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recalculate stock when entering the view
  useMemo(() => {
    setStockStatus(getProjectStockStatus());
  }, [project, receptions]);

  const handleCapturePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleAddItem = (material: Material, quantity: number) => {
     // Check if already added
     if (selectedItems.find(i => i.materialId === material.id)) return;
     
     setSelectedItems(prev => [...prev, {
         materialId: material.id,
         quantityDeclared: quantity,
         quantityReceived: quantity
     }]);
     setIsPickerOpen(false);
  };

  const updateItemQty = (idx: number, field: 'quantityDeclared' | 'quantityReceived', val: number) => {
      const newItems = [...selectedItems];
      newItems[idx] = { ...newItems[idx], [field]: val };
      setSelectedItems(newItems);
  };

  const removeItem = (idx: number) => {
      setSelectedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const confirmReception = () => {
      if (!remitoNumber || selectedItems.length === 0) {
          alert("Debe ingresar número de remito y al menos un material.");
          return;
      }

      const newReception: Reception = {
          id: crypto.randomUUID(),
          organizationId: 'org_a',
          date: new Date().toISOString(),
          projectId: project.id,
          remitoNumber,
          provider,
          photoUrl: photo || undefined,
          items: selectedItems,
          status: 'confirmed'
      };

      addReception(newReception);
      
      // Reset & Exit
      setRemitoNumber('');
      setProvider('');
      setPhoto(null);
      setSelectedItems([]);
      setView('list');
  };

  // --- Sub-Components ---
  
  const MaterialPicker = () => {
      const filteredMaterials = stockStatus.filter(s => 
          s.material.name.toLowerCase().includes(pickerSearch.toLowerCase())
      );

      return (
          <div className="fixed inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-bottom">
              <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                  <button onClick={() => setIsPickerOpen(false)}><X size={24} className="text-slate-500"/></button>
                  <input 
                    autoFocus
                    placeholder="Buscar material..." 
                    className="flex-1 text-lg outline-none"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                  />
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase m-2">Materiales Pendientes de Ingreso</h4>
                  {filteredMaterials.filter(s => s.pending > 0).map(s => (
                      <div key={s.material.id} onClick={() => handleAddItem(s.material, s.pending)} 
                           className="p-4 border-b border-slate-100 active:bg-slate-50 flex justify-between items-center cursor-pointer">
                          <div>
                              <div className="font-bold text-slate-800">{s.material.name}</div>
                              <div className="text-xs text-slate-500">Pendiente: {s.pending.toFixed(2)} {s.material.unit}</div>
                          </div>
                          <Plus className="text-blue-600" />
                      </div>
                  ))}
                  
                  <h4 className="text-xs font-bold text-slate-400 uppercase m-2 mt-6">Todos los Materiales</h4>
                  {filteredMaterials.filter(s => s.pending <= 0).map(s => (
                      <div key={s.material.id} onClick={() => handleAddItem(s.material, 1)} 
                           className="p-4 border-b border-slate-100 active:bg-slate-50 flex justify-between items-center cursor-pointer">
                          <div>
                              <div className="font-bold text-slate-800">{s.material.name}</div>
                              <div className="text-xs text-slate-500">{s.material.unit}</div>
                          </div>
                          <Plus className="text-slate-300" />
                      </div>
                  ))}
              </div>
          </div>
      )
  };

  return (
    <div className="max-w-md mx-auto h-full bg-slate-50 flex flex-col relative md:border md:border-slate-200 md:rounded-xl md:shadow-xl md:h-[800px] md:my-10 overflow-hidden">
        
        {/* VIEW: DASHBOARD */}
        {view === 'list' && (
            <>
                <div className="bg-slate-900 text-white p-6 pb-12 rounded-b-[2.5rem] shadow-lg relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold">Recepción</h2>
                            <p className="text-slate-400 text-sm">{project.name}</p>
                        </div>
                        <div className="bg-slate-800 p-2 rounded-full">
                            <Truck size={24} className="text-blue-400" />
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setView('new')}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold shadow-lg shadow-blue-900/50 flex items-center justify-center gap-3 transition-transform active:scale-95"
                    >
                        <Plus size={24} /> Nueva Recepción
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 -mt-8 pt-10 pb-4 space-y-4">
                    <h3 className="font-bold text-slate-700 ml-2">Historial de Ingresos</h3>
                    {receptions.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <ClipboardList size={48} className="mx-auto mb-2 opacity-50" />
                            <p>No hay remitos cargados.</p>
                        </div>
                    ) : (
                        receptions.map(rec => (
                            <div key={rec.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                                {rec.photoUrl ? (
                                    <img src={rec.photoUrl} className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><ImageIcon size={20}/></div>
                                )}
                                <div className="flex-1">
                                    <div className="font-bold text-slate-800">Remito #{rec.remitoNumber}</div>
                                    <div className="text-xs text-slate-500">{new Date(rec.date).toLocaleDateString()} • {rec.items.length} ítems</div>
                                </div>
                                <ChevronRight className="text-slate-300" />
                            </div>
                        ))
                    )}
                </div>
            </>
        )}

        {/* VIEW: NEW RECEPTION FORM */}
        {view === 'new' && (
            <div className="flex flex-col h-full bg-white animate-in slide-in-from-right">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                    <button onClick={() => setView('list')} className="p-2 -ml-2 text-slate-500"><ArrowLeft /></button>
                    <h2 className="font-bold text-lg text-slate-800">Nuevo Ingreso</h2>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* General Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nro. de Remito</label>
                            <input 
                                type="text" 
                                className="w-full text-lg p-3 border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
                                placeholder="0001-00001234"
                                value={remitoNumber}
                                onChange={e => setRemitoNumber(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Proveedor (Opcional)</label>
                            <input 
                                type="text" 
                                className="w-full p-3 border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
                                placeholder="Corralón..."
                                value={provider}
                                onChange={e => setProvider(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Photo Upload */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Foto del Comprobante</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${photo ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50'}`}
                        >
                            {photo ? (
                                <>
                                    <img src={photo} className="max-h-40 rounded shadow-sm" />
                                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={12}/> Foto Cargada</span>
                                </>
                            ) : (
                                <>
                                    <Camera size={32} className="text-slate-400" />
                                    <span className="text-sm font-medium text-slate-500">Tomar Foto / Subir</span>
                                </>
                            )}
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleCapturePhoto}
                            />
                        </div>
                    </div>

                    {/* Items List */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                             <label className="block text-xs font-bold text-slate-500 uppercase">Materiales Recibidos</label>
                             <button onClick={() => setIsPickerOpen(true)} className="text-xs font-bold text-blue-600 flex items-center gap-1"><Plus size={14}/> Agregar</button>
                        </div>
                        
                        <div className="space-y-3">
                            {selectedItems.length === 0 && (
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center text-sm text-slate-400 italic">
                                    Agregue los ítems que figuran en el remito.
                                </div>
                            )}
                            {selectedItems.map((item, idx) => {
                                const matInfo = materials.find(m => m.id === item.materialId);
                                const stockInfo = stockStatus.find(s => s.material.id === item.materialId);
                                const isDiscrepancy = item.quantityReceived > (stockInfo?.pending || 0) + (stockInfo?.budgeted ? stockInfo.budgeted * 0.1 : 9999);

                                return (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm relative">
                                        <button onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><X size={16}/></button>
                                        
                                        <div className="font-bold text-slate-800 mb-1 pr-6">{matInfo?.name}</div>
                                        <div className="text-xs text-slate-500 mb-3 flex gap-2">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded">Pendiente: {stockInfo?.pending.toFixed(2)} {matInfo?.unit}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Cant. Recibida</label>
                                                <input 
                                                    type="number" 
                                                    className={`w-full p-2 border rounded font-bold text-lg outline-none ${isDiscrepancy ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300'}`}
                                                    value={item.quantityReceived}
                                                    onChange={e => updateItemQty(idx, 'quantityReceived', parseFloat(e.target.value))}
                                                />
                                            </div>
                                            <div className="w-12 text-center pt-4 text-slate-400 font-bold text-sm">
                                                {matInfo?.unit}
                                            </div>
                                        </div>
                                        {isDiscrepancy && (
                                            <div className="mt-2 flex items-start gap-1 text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded">
                                                <AlertTriangle size={12} className="mt-0.5" />
                                                <span>Atención: La cantidad supera lo pendiente estimado.</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <button 
                        onClick={confirmReception}
                        disabled={selectedItems.length === 0 || !remitoNumber}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Confirmar Ingreso
                    </button>
                </div>
            </div>
        )}

        {isPickerOpen && <MaterialPicker />}
    </div>
  );
};