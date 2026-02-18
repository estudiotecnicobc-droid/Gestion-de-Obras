
import React, { useState, useEffect } from 'react';
import { ERPProvider, useERP } from './context/ERPContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { BudgetEditor } from './components/BudgetEditor';
import { BudgetGrid } from './components/BudgetGrid';
import { Planning } from './components/Planning';
import { DataAdmin } from './components/DataAdmin';
import { ToolsManager } from './components/ToolsManager';
import { ProjectSettings } from './components/ProjectSettings';
import { MaterialReception } from './components/MaterialReception';
import { ManagementPanel } from './components/ManagementPanel';
import { Subcontractors } from './components/Subcontractors';
import { DocumentManager } from './components/DocumentManager';
import { MeasurementSheetComponent } from './components/MeasurementSheet';
import { QualityControl } from './components/QualityControl';
import { ProjectHub } from './components/ProjectHub';
import { APUBuilder } from './components/APUBuilder';
import { Role } from './types';

// Route Protection Component (Middleware Simulation)
const ProtectedRoute: React.FC<{ 
  allowedRoles: Role[], 
  children: React.ReactNode 
}> = ({ allowedRoles, children }) => {
  const { user } = useAuth();
  
  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <div className="text-4xl mb-4">🚫</div>
        <h2 className="text-xl font-bold text-slate-700">Acceso Restringido</h2>
        <p>No tienes permisos para ver este módulo.</p>
      </div>
    );
  }
  return <>{children}</>;
};

const AppContent = () => {
  const { user } = useAuth();
  const { activeProjectId } = useERP();
  const [activeTab, setActiveTab] = useState('dashboard');

  // STATE 1: Unauthenticated
  if (!user) {
    return <Login />;
  }

  // STATE 2: Authenticated but No Project Selected -> HUB
  if (!activeProjectId) {
      return <ProjectHub />;
  }

  // STATE 3: Active Project (Main Layout)
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': 
        return <ProtectedRoute allowedRoles={['admin', 'engineering', 'foreman', 'client']}><Dashboard /></ProtectedRoute>;
      case 'management': 
        return <ProtectedRoute allowedRoles={['admin', 'engineering', 'client']}><ManagementPanel /></ProtectedRoute>;
      case 'subcontractors': 
        return <ProtectedRoute allowedRoles={['admin', 'engineering']}><Subcontractors /></ProtectedRoute>;
      case 'budget': 
        return <ProtectedRoute allowedRoles={['admin', 'engineering']}><BudgetEditor /></ProtectedRoute>;
      case 'apu':
        return <ProtectedRoute allowedRoles={['admin', 'engineering']}><APUBuilder /></ProtectedRoute>;
      case 'grid': 
        return <ProtectedRoute allowedRoles={['admin', 'engineering']}><BudgetGrid /></ProtectedRoute>;
      case 'planning': 
        return <ProtectedRoute allowedRoles={['admin', 'engineering', 'foreman']}><Planning /></ProtectedRoute>;
      case 'reception': 
        return <ProtectedRoute allowedRoles={['admin', 'foreman']}><MaterialReception /></ProtectedRoute>;
      case 'tools': 
        return <ProtectedRoute allowedRoles={['admin', 'engineering']}><ToolsManager /></ProtectedRoute>;
      case 'admin': 
        return <ProtectedRoute allowedRoles={['admin', 'engineering']}><DataAdmin /></ProtectedRoute>;
      case 'settings': 
        return <ProtectedRoute allowedRoles={['admin']}><ProjectSettings /></ProtectedRoute>;
      case 'documents':
        return <ProtectedRoute allowedRoles={['admin', 'engineering', 'foreman', 'client']}><DocumentManager /></ProtectedRoute>;
      case 'measurements':
        return <ProtectedRoute allowedRoles={['admin', 'engineering']}><MeasurementSheetComponent /></ProtectedRoute>;
      case 'quality':
        return <ProtectedRoute allowedRoles={['admin', 'engineering', 'foreman']}><QualityControl /></ProtectedRoute>;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <ERPProvider>
        <AppContent />
      </ERPProvider>
    </AuthProvider>
  );
};

export default App;
