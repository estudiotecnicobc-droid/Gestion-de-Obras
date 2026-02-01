import React from 'react';
import { LayoutDashboard, Calculator, CalendarDays, Settings, HardHat, Wrench, SlidersHorizontal, Table, Truck, TrendingUp, Users, LogOut, Ruler, FileText, FolderPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';
import { useERP } from '../context/ERPContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { user, logout, hasPermission } = useAuth();
  const { project, setActiveProject } = useERP();

  // Define menu items with required permissions
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'engineering', 'foreman', 'client'] },
    { id: 'management', label: 'Control de Gestión', icon: TrendingUp, roles: ['admin', 'engineering', 'client'] },
    { id: 'documents', label: 'Documentación', icon: FileText, roles: ['admin', 'engineering', 'foreman', 'client'] }, // NEW
    { id: 'measurements', label: 'Cómputos (Mediciones)', icon: Ruler, roles: ['admin', 'engineering'] }, // NEW
    { id: 'subcontractors', label: 'Subcontratistas', icon: Users, roles: ['admin', 'engineering'] },
    { id: 'budget', label: 'Presupuesto', icon: Calculator, roles: ['admin', 'engineering'] },
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
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0 print:hidden transition-all">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-blue-600 p-2 rounded-lg">
            <HardHat size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Construsoft</h1>
            <span className="text-xs text-slate-400">ERP Construction</span>
          </div>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-800">
            <div className="text-sm font-bold text-white">{user?.name}</div>
            <div className="text-xs text-slate-400 flex items-center justify-between">
                <span className="capitalize">{user?.role}</span>
                <span className="bg-slate-700 px-1.5 rounded text-[10px] uppercase tracking-wide text-slate-300">{user?.organizationId === 'org_a' ? 'Empresa A' : 'Empresa B'}</span>
            </div>
        </div>

        {/* Project Selector (Mock) */}
        <div className="px-6 py-3 border-b border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Proyecto Activo</div>
            <div className="flex items-center justify-between text-sm font-medium text-blue-400 truncate">
                <span className="truncate">{project.name}</span>
            </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-800 space-y-2">
            <button onClick={logout} className="w-full flex items-center gap-2 text-slate-400 hover:text-red-400 text-sm font-bold px-4 py-2 hover:bg-slate-800 rounded-lg transition-colors">
                <LogOut size={16} /> Cerrar Sesión
            </button>
            <div className="text-xs text-slate-600 text-center mt-4">v1.5.0 &copy; 2024</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto h-full">
            {children}
        </div>
      </main>
    </div>
  );
};