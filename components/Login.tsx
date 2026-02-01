import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HardHat, Shield, Users, Hammer, Eye } from 'lucide-react';
import { Role } from '../types';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState('org_a');

  const handleLogin = (role: Role) => {
    login(role, selectedOrg);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 text-center bg-slate-50 border-b border-slate-100">
          <div className="mx-auto bg-blue-600 w-16 h-16 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 mb-4">
            <HardHat size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-800">Construsoft ERP</h1>
          <p className="text-slate-500 text-sm mt-1">Acceso Seguro Multitenant</p>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Seleccionar Empresa (Tenant)</label>
            <select 
              className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
            >
              <option value="org_a">Constructora A (Empresa Principal)</option>
              <option value="org_b">Constructora B (Sucursal Norte)</option>
            </select>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-center font-bold text-slate-400 uppercase">Seleccione un Rol para Ingresar</p>
            
            <button 
              onClick={() => handleLogin('admin')}
              className="w-full p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-4 group"
            >
              <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-200 text-slate-600 group-hover:text-blue-700">
                <Shield size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-800">Administrador</div>
                <div className="text-xs text-slate-500">Acceso total al sistema</div>
              </div>
            </button>

            <button 
              onClick={() => handleLogin('engineering')}
              className="w-full p-4 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition-all flex items-center gap-4 group"
            >
              <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-purple-200 text-slate-600 group-hover:text-purple-700">
                <Hammer size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-800">Ingeniería</div>
                <div className="text-xs text-slate-500">Edición de Presupuestos y APU</div>
              </div>
            </button>

            <button 
              onClick={() => handleLogin('foreman')}
              className="w-full p-4 rounded-xl border border-slate-200 hover:border-orange-500 hover:bg-orange-50 transition-all flex items-center gap-4 group"
            >
              <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-orange-200 text-slate-600 group-hover:text-orange-700">
                <Users size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-800">Capataz / Obra</div>
                <div className="text-xs text-slate-500">Remitos, Fotos y Avances</div>
              </div>
            </button>

            <button 
              onClick={() => handleLogin('client')}
              className="w-full p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center gap-4 group"
            >
              <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-emerald-200 text-slate-600 group-hover:text-emerald-700">
                <Eye size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-800">Cliente</div>
                <div className="text-xs text-slate-500">Solo lectura de reportes</div>
              </div>
            </button>
          </div>
        </div>
        
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-[10px] text-slate-400">Simulación de seguridad RBAC y Multitenant</p>
        </div>
      </div>
    </div>
  );
};