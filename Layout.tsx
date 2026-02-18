
import React, { useState } from 'react';
import { LayoutDashboard, Calculator, CalendarDays, Settings, HardHat, Wrench, SlidersHorizontal, Table, Truck, TrendingUp, Users, LogOut, Ruler, FileText, ClipboardCheck, Save, CheckCircle2, ArrowLeftRight, Building, PenTool } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';
import { useERP } from '../context/ERPContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const { project, saveProject, exitProject } = useERP();
  const [isSaving, setIsSaving] = useState(false);

  const handleGlobalSave = async () => {
      setIsSaving(true);
      await saveProject();
      setIsSaving(false);
  };

  // Define menu items with required permissions
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'engineering', 'foreman', 'client'] },
    { id: 'management', label: 'Control de Gestión', icon: TrendingUp, roles: ['admin', 'engineering', 'client'] },
    { id: 'documents', label: 'Documentación', icon: FileText, roles: ['admin', 'engineering', 'foreman', 'client'] }, 
    { id: 'quality', label: 'Control Calidad', icon: ClipboardCheck, roles: ['admin', 'engineering', 'foreman'] }, 
    { id: 'measurements', label: 'Cómputos (Mediciones)', icon: Ruler, roles: ['admin', 'engineering'] }, 
    { id: 'subcontractors', label: 'Subcontratistas', icon: Users, roles: ['admin', 'engineering'] },
    { id: 'budget', label: 'Presupuesto', icon: Calculator, roles: ['admin', 'engineering'] },
    { id: 'apu', label: 'Analizador APU', icon: PenTool, roles: ['admin', 'engineering'] },
    { id: 'grid', label: 'Grilla de Costos', icon: Table, roles: ['admin', 'engineering'] },
    { id: 'planning', label: 'Planificación', icon: CalendarDays, roles: ['admin', 'engineering', 'foreman'] },
    { id: 'reception', label: 'Recepción (Remitos)', icon: Truck, roles: ['admin', 'foreman'] },
    { id: 'tools', label: 'Equipos', icon: Wrench, roles: ['admin', 'engineering'] },
    { id: 'admin', label: 'Base de Datos', icon: Settings, roles: ['admin', 'engineering'] },
    { id: 'settings', label: 'Configuración', icon: SlidersHorizontal, roles: ['admin'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(user?.role as Role));

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 print:hidden transition-all relative z-20 shadow-xl">
        
        {/* Sidebar Header with Context Card */}
        <div className="p-4 bg-slate-950">
            <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Building size={10} /> Proyecto Activo
                    </span>
                    <button 
                        onClick={exitProject}
                        className="text-[10px] bg-slate-700 hover:bg-blue-600 text-slate-200 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1"
                        title="Cambiar de Proyecto"
                    >
                        <ArrowLeftRight size={10} /> Cambiar
                    </button>
                </div>
                <div className="font-bold text-white text-sm truncate leading-tight mb-1" title={project.name}>
                    {project.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{project.client}</div>
            </div>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 border-b border-slate-800/50">
            <div className="text-sm font-bold text-white">{user?.name}</div>
            <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
                <span className="capitalize bg-slate-800 px-2 py-0.5 rounded-full">{user?.role}</span>
            </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-800 space-y-2 bg-slate-900">
            <button 
                onClick={handleGlobalSave}
                disabled={isSaving}
                className={`w-full flex items-center justify-center gap-2 text-white text-sm font-bold px-4 py-3 rounded-lg transition-all shadow-md ${isSaving ? 'bg-emerald-600' : 'bg-blue-700 hover:bg-blue-600'}`}
            >
                {isSaving ? (
                    <><CheckCircle2 size={18} className="animate-bounce"/> Guardando...</>
                ) : (
                    <><Save size={18} /> Guardar Todo</>
                )}
            </button>

            <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 text-xs font-bold px-4 py-2 hover:bg-slate-800 rounded-lg transition-colors mt-2">
                <LogOut size={14} /> Cerrar Sesión
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-100">
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto h-full">
            {children}
        </div>
      </main>
    </div>
  );
};
