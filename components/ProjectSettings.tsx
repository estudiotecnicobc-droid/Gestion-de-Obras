import React, { useState, useEffect } from 'react';
import { useERP } from '../context/ERPContext';
import { Building, MapPin, User, Calendar, Save, CreditCard, Briefcase, CheckCircle, Ruler, Component, Layers, ArrowDownCircle, BookOpen, Clock, CalendarX, Plus, Trash2, FolderOpen, Bookmark } from 'lucide-react';
import { CONSTRUCTION_SYSTEMS, STRUCTURE_TYPES, FOUNDATION_TYPES, PROJECT_TEMPLATES } from '../constants';
import { Holiday } from '../types';

export const ProjectSettings: React.FC = () => {
  const { project, updateProjectSettings, loadTemplate, calendarPresets, addCalendarPreset, applyCalendarPreset } = useERP();
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    address: '',
    companyName: '',
    startDate: '',
    currency: '$',
    surface: '',
    constructionSystem: '',
    structureType: '',
    foundationType: '',
    workdayHours: 9,
    workdayStartTime: "08:00",
    workdayEndTime: "17:00",
    lunchBreakDuration: 60
  });
  const [workingDays, setWorkingDays] = useState<number[]>([1,2,3,4,5]);
  const [nonWorkingDates, setNonWorkingDates] = useState<Holiday[]>([]);
  
  // New holiday form
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');
  
  // Preset form
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadMsg, setLoadMsg] = useState('');

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        client: project.client || '',
        address: project.address || '',
        companyName: project.companyName || '',
        startDate: project.startDate || '',
        currency: project.currency || '$',
        surface: project.surface?.toString() || '',
        constructionSystem: project.constructionSystem || '',
        structureType: project.structureType || '',
        foundationType: project.foundationType || '',
        workdayHours: project.workdayHours || 9,
        workdayStartTime: project.workdayStartTime || "08:00",
        workdayEndTime: project.workdayEndTime || "17:00",
        lunchBreakDuration: project.lunchBreakDuration || 60
      });
      setWorkingDays(project.workingDays || [1,2,3,4,5]);
      setNonWorkingDates(project.nonWorkingDates || []);
    }
  }, [project]);

  const handleSave = () => {
    updateProjectSettings({
      ...formData,
      surface: parseFloat(formData.surface) || 0,
      workingDays: workingDays.sort(),
      nonWorkingDates: nonWorkingDates
    });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const toggleWorkingDay = (dayIndex: number) => {
      const currentDays = new Set(workingDays);
      if (currentDays.has(dayIndex)) {
          currentDays.delete(dayIndex);
      } else {
          currentDays.add(dayIndex);
      }
      setWorkingDays(Array.from(currentDays));
  };

  const addHoliday = () => {
      if(newHolidayDate && !nonWorkingDates.find(h => h.date === newHolidayDate)) {
          setNonWorkingDates([...nonWorkingDates, { date: newHolidayDate, description: newHolidayDesc || 'Feriado' }].sort((a,b) => a.date.localeCompare(b.date)));
          setNewHolidayDate('');
          setNewHolidayDesc('');
      }
  };

  const removeHoliday = (date: string) => {
      setNonWorkingDates(nonWorkingDates.filter(d => d.date !== date));
  };

  const handleLoadTemplate = () => {
    const tmpl = PROJECT_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (tmpl) {
      if(window.confirm(`¿Cargar plantilla "${tmpl.name}"?\nEsto agregará ${tmpl.tasks.length} tareas a su base de datos y al presupuesto actual.`)) {
        loadTemplate(tmpl);
        setLoadMsg(`Se cargaron ${tmpl.tasks.length} ítems exitosamente.`);
        setTimeout(() => setLoadMsg(''), 3000);
      }
    }
  };

  // --- Calendar Presets Logic ---
  const handleSavePreset = () => {
      if (!presetName) return;
      addCalendarPreset({
          id: crypto.randomUUID(),
          name: presetName,
          workdayHours: formData.workdayHours,
          workdayStartTime: formData.workdayStartTime,
          workdayEndTime: formData.workdayEndTime,
          lunchBreakDuration: formData.lunchBreakDuration,
          workingDays: workingDays,
          nonWorkingDates: nonWorkingDates
      });
      setPresetName('');
      alert("Configuración de calendario guardada como plantilla.");
  };

  const handleApplyPreset = () => {
      if (!selectedPresetId) return;
      if (window.confirm("¿Aplicar esta configuración de calendario al proyecto actual? Esto sobrescribirá sus ajustes de jornada y feriados.")) {
          applyCalendarPreset(selectedPresetId);
          setSelectedPresetId('');
      }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-8 border-b border-slate-100 pb-6">
          <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200">
            <Building size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Configuración de Obra</h2>
            <p className="text-slate-500">Defina los parámetros generales y legales del proyecto actual.</p>
          </div>
        </div>

        {showSuccess && (
          <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2 border border-green-200 animate-in fade-in">
            <CheckCircle size={20} />
            <span className="font-bold">Configuración guardada exitosamente.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Columna Izquierda: Datos del Proyecto */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Briefcase size={16} /> Datos del Proyecto
            </h3>
            
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Nombre del Proyecto</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Ej: Edificio Altamira"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Cliente / Comitente</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  value={formData.client}
                  onChange={e => setFormData({...formData, client: e.target.value})}
                  placeholder="Nombre del Cliente"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Ubicación de la Obra</label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="Dirección del sitio"
                />
              </div>
            </div>

            {/* Ficha Técnica (Nueva Sección) */}
            <div className="pt-4 border-t border-slate-100">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <Ruler size={16} /> Especificaciones Técnicas
               </h3>
               
               <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Superficie Cubierta (m²)</label>
                    <input
                        type="number"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono font-bold"
                        value={formData.surface}
                        onChange={e => setFormData({...formData, surface: e.target.value})}
                        placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Sistema Constructivo</label>
                    <div className="relative">
                        <Component size={18} className="absolute left-3 top-3.5 text-slate-400" />
                        <select 
                           className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                           value={formData.constructionSystem}
                           onChange={e => setFormData({...formData, constructionSystem: e.target.value})}
                        >
                            <option value="">-- Seleccionar --</option>
                            {CONSTRUCTION_SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Tipo de Estructura</label>
                    <div className="relative">
                        <Building size={18} className="absolute left-3 top-3.5 text-slate-400" />
                        <select 
                           className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                           value={formData.structureType}
                           onChange={e => setFormData({...formData, structureType: e.target.value})}
                        >
                            <option value="">-- Seleccionar --</option>
                            {STRUCTURE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Fundaciones</label>
                    <div className="relative">
                        <Layers size={18} className="absolute left-3 top-3.5 text-slate-400" />
                        <select 
                           className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                           value={formData.foundationType}
                           onChange={e => setFormData({...formData, foundationType: e.target.value})}
                        >
                            <option value="">-- Seleccionar --</option>
                            {FOUNDATION_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                  </div>
               </div>
            </div>
          </div>

          {/* Columna Derecha: Configuración y Empresa */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Building size={16} /> Datos Corporativos y Sistema
            </h3>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Empresa Constructora</label>
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                value={formData.companyName}
                onChange={e => setFormData({...formData, companyName: e.target.value})}
                placeholder="Su Empresa S.A."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Fecha de Inicio</label>
                  <div className="relative">
                    <Calendar size={18} className="absolute left-3 top-3.5 text-slate-400" />
                    <input
                      type="date"
                      className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      value={formData.startDate}
                      onChange={e => setFormData({...formData, startDate: e.target.value})}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">Determina el inicio del Diagrama de Gantt.</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Moneda</label>
                  <div className="relative">
                    <CreditCard size={18} className="absolute left-3 top-3.5 text-slate-400" />
                    <select
                      className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
                      value={formData.currency}
                      onChange={e => setFormData({...formData, currency: e.target.value})}
                    >
                      <option value="$">$ (Peso/Dólar)</option>
                      <option value="€">€ (Euro)</option>
                      <option value="S/">S/ (Sol)</option>
                      <option value="UF">UF (Unidad Fomento)</option>
                    </select>
                  </div>
                </div>
            </div>

            {/* Jornada Laboral */}
            <div className="pt-4 border-t border-slate-100">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <Clock size={16} /> Jornada y Calendario
               </h3>
               
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                   
                   {/* Actions Row */}
                   <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg border border-blue-100 mb-4">
                       <div className="flex gap-2">
                           <input 
                             placeholder="Guardar como Plantilla..." 
                             className="text-xs p-1.5 border rounded w-32"
                             value={presetName}
                             onChange={e => setPresetName(e.target.value)}
                           />
                           <button onClick={handleSavePreset} disabled={!presetName} className="text-blue-600 hover:text-blue-800 disabled:opacity-50"><Bookmark size={16}/></button>
                       </div>
                       <div className="flex gap-2">
                           <select 
                             className="text-xs p-1.5 border rounded max-w-[120px]"
                             value={selectedPresetId}
                             onChange={e => setSelectedPresetId(e.target.value)}
                           >
                               <option value="">Cargar Plantilla...</option>
                               {calendarPresets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                           </select>
                           <button onClick={handleApplyPreset} disabled={!selectedPresetId} className="text-emerald-600 hover:text-emerald-800 disabled:opacity-50"><FolderOpen size={16}/></button>
                       </div>
                   </div>

                   {/* Horarios */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                       <div className="col-span-1">
                           <label className="block text-xs font-bold text-slate-600 mb-1">Entrada</label>
                           <input type="time" className="w-full p-2 border rounded text-sm" value={formData.workdayStartTime} onChange={e => setFormData({...formData, workdayStartTime: e.target.value})} />
                       </div>
                       <div className="col-span-1">
                           <label className="block text-xs font-bold text-slate-600 mb-1">Salida</label>
                           <input type="time" className="w-full p-2 border rounded text-sm" value={formData.workdayEndTime} onChange={e => setFormData({...formData, workdayEndTime: e.target.value})} />
                       </div>
                       <div className="col-span-1">
                           <label className="block text-xs font-bold text-slate-600 mb-1">Almuerzo (min)</label>
                           <input type="number" className="w-full p-2 border rounded text-sm" value={formData.lunchBreakDuration} onChange={e => setFormData({...formData, lunchBreakDuration: parseFloat(e.target.value)})} />
                       </div>
                       <div className="col-span-1">
                           <label className="block text-xs font-bold text-slate-600 mb-1">Total (h)</label>
                           <input type="number" className="w-full p-2 border rounded text-sm bg-slate-100 font-bold" value={formData.workdayHours} readOnly />
                       </div>
                   </div>

                   {/* Dias Laborables */}
                   <div>
                       <label className="block text-xs font-bold text-slate-600 mb-2">Días Laborables Semanales</label>
                       <div className="flex gap-2">
                          {['D','L','M','M','J','V','S'].map((day, i) => {
                              const isActive = workingDays.includes(i);
                              return (
                                  <button 
                                    key={i}
                                    onClick={() => toggleWorkingDay(i)}
                                    className={`w-8 h-8 rounded font-bold text-xs transition-all border ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'}`}
                                  >
                                      {day}
                                  </button>
                              )
                          })}
                       </div>
                   </div>

                   {/* Feriados y Excepciones */}
                   <div>
                       <label className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-2">
                           <CalendarX size={14} className="text-red-500" /> Días No Laborables (Feriados)
                       </label>
                       <div className="flex gap-2 mb-2">
                           <input 
                              type="date" 
                              className="w-32 p-2 border border-slate-200 rounded text-sm"
                              value={newHolidayDate}
                              onChange={e => setNewHolidayDate(e.target.value)}
                           />
                           <input 
                              type="text" 
                              className="flex-1 p-2 border border-slate-200 rounded text-sm"
                              placeholder="Motivo (ej: Navidad)"
                              value={newHolidayDesc}
                              onChange={e => setNewHolidayDesc(e.target.value)}
                           />
                           <button onClick={addHoliday} disabled={!newHolidayDate} className="px-3 py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-black disabled:opacity-50 flex items-center gap-1">
                               <Plus size={14} /> Agregar
                           </button>
                       </div>
                       <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                           {nonWorkingDates.length === 0 && <span className="text-xs text-slate-400 italic">No hay feriados cargados.</span>}
                           {nonWorkingDates.map(h => (
                               <div key={h.date} className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-medium border border-red-100" title={h.description}>
                                   <span>{new Date(h.date).toLocaleDateString()} - {h.description}</span>
                                   <button onClick={() => removeHoliday(h.date)} className="hover:text-red-900"><Trash2 size={12} /></button>
                               </div>
                           ))}
                       </div>
                   </div>
               </div>
            </div>

            {/* Template Loader */}
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-5">
               <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <BookOpen size={16} /> Precarga de Tareas
               </h3>
               <p className="text-xs text-blue-600 mb-4">
                 Puede cargar un listado estándar de tareas según el tipo de obra para acelerar la carga del presupuesto.
               </p>
               
               <div className="space-y-3">
                  <select 
                    className="w-full p-2 text-sm border border-blue-200 rounded-lg focus:outline-none"
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                  >
                     <option value="">-- Seleccionar Plantilla --</option>
                     {PROJECT_TEMPLATES.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                     ))}
                  </select>
                  
                  <button 
                    onClick={handleLoadTemplate}
                    disabled={!selectedTemplateId}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                     <ArrowDownCircle size={18} /> Cargar Tareas al Presupuesto
                  </button>
                  {loadMsg && <p className="text-xs font-bold text-green-600 text-center animate-in fade-in">{loadMsg}</p>}
               </div>
            </div>

          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all shadow-lg shadow-slate-200 flex items-center gap-2 transform active:scale-95"
          >
            <Save size={20} /> Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};