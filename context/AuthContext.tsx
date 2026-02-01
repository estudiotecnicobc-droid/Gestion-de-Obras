import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  login: (role: Role, organizationId: string) => void;
  logout: () => void;
  hasPermission: (requiredRoles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('erp_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('erp_user_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('erp_user_session');
    }
  }, [user]);

  const login = (role: Role, organizationId: string) => {
    // Simulación de Login - En producción esto validaría contra backend
    const mockUser: User = {
      id: crypto.randomUUID(),
      name: role === 'admin' ? 'Administrador' : role === 'engineering' ? 'Ing. Civil' : role === 'foreman' ? 'Capataz Obra' : 'Cliente Visor',
      email: `${role}@empresa.com`,
      role: role,
      organizationId: organizationId
    };
    setUser(mockUser);
  };

  const logout = () => {
    setUser(null);
  };

  const hasPermission = (requiredRoles: Role[]) => {
    if (!user) return false;
    return requiredRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};