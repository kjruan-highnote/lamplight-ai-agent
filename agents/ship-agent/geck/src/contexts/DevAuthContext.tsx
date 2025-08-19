import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, ROLE_PERMISSIONS, UserRole } from '../types';

// Development mock users
const MOCK_USERS: Record<string, User> = {
  engineer: {
    _id: 'dev-engineer-001',
    email: 'engineer@dev.local',
    name: 'Dev Engineer',
    role: 'technical_implementation_engineer',
    isActive: true,
    permissions: ROLE_PERMISSIONS.technical_implementation_engineer,
    department: 'Engineering',
    preferences: {
      theme: 'vault-tec',
      defaultView: 'grid',
    },
  },
  solutions: {
    _id: 'dev-solutions-001',
    email: 'solutions@dev.local',
    name: 'Dev Solutions',
    role: 'solutions_engineer',
    isActive: true,
    permissions: ROLE_PERMISSIONS.solutions_engineer,
    department: 'Solutions',
    preferences: {
      theme: 'vault-tec',
      defaultView: 'list',
    },
  },
  admin: {
    _id: 'dev-admin-001',
    email: 'admin@dev.local',
    name: 'Dev Admin',
    role: 'admin',
    isActive: true,
    permissions: ROLE_PERMISSIONS.admin,
    department: 'Administration',
    preferences: {
      theme: 'corporate',
      defaultView: 'grid',
    },
  },
};

interface DevAuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  hasPermission: (resource: string, action: string) => boolean;
  canAccess: (path: string) => boolean;
  quickLogin: (role: UserRole) => void;
  isDevMode: boolean;
}

const DevAuthContext = createContext<DevAuthContextType | undefined>(undefined);

export const DevAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    // Auto-login in development if configured
    const autoLoginRole = process.env.REACT_APP_DEV_AUTO_LOGIN_ROLE;
    const savedDevUser = localStorage.getItem('geck-dev-user');
    
    if (autoLoginRole && MOCK_USERS[autoLoginRole]) {
      return {
        user: MOCK_USERS[autoLoginRole],
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    } else if (savedDevUser) {
      try {
        const user = JSON.parse(savedDevUser);
        return {
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        };
      } catch {
        // Invalid saved user
      }
    }
    
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    };
  });

  useEffect(() => {
    // Save current user to localStorage for persistence
    if (authState.user) {
      localStorage.setItem('geck-dev-user', JSON.stringify(authState.user));
    } else {
      localStorage.removeItem('geck-dev-user');
    }
  }, [authState.user]);

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // In dev mode, accept any password and match user by email pattern
    let user: User | null = null;
    
    if (email.includes('admin')) {
      user = MOCK_USERS.admin;
    } else if (email.includes('solution')) {
      user = MOCK_USERS.solutions;
    } else if (email.includes('engineer') || email) {
      user = MOCK_USERS.engineer;
    }
    
    if (user) {
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } else {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Invalid credentials',
      });
      throw new Error('Invalid credentials');
    }
  };

  const logout = async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    localStorage.removeItem('geck-dev-user');
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  };

  const quickLogin = (role: UserRole) => {
    const userKey = role === 'technical_implementation_engineer' ? 'engineer' : 
                    role === 'solutions_engineer' ? 'solutions' : 'admin';
    const user = MOCK_USERS[userKey];
    
    setAuthState({
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  };

  const updateUser = (updates: Partial<User>) => {
    setAuthState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updates } : null,
    }));
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!authState.user) return false;
    
    const permissions = authState.user.permissions;
    
    switch (resource) {
      case 'contexts':
        return permissions.contexts[action as keyof typeof permissions.contexts] || false;
      case 'programs':
        return permissions.programs[action as keyof typeof permissions.programs] || false;
      case 'operations':
        return permissions.operations[action as keyof typeof permissions.operations] || false;
      case 'system':
        return permissions.system[action as keyof typeof permissions.system] || false;
      default:
        return false;
    }
  };

  const canAccess = (path: string): boolean => {
    if (!authState.user) return false;
    
    const routePermissions: Record<string, { resource: string; action: string }> = {
      '/': { resource: 'system', action: 'viewDashboard' },
      '/contexts': { resource: 'contexts', action: 'view' },
      '/contexts/new': { resource: 'contexts', action: 'create' },
      '/programs': { resource: 'programs', action: 'view' },
      '/programs/new': { resource: 'programs', action: 'create' },
      '/operations': { resource: 'operations', action: 'view' },
      '/solution': { resource: 'system', action: 'generateSolutions' },
      '/sync': { resource: 'system', action: 'syncPostman' },
      '/settings': { resource: 'system', action: 'configureSettings' },
      '/users': { resource: 'system', action: 'manageUsers' },
    };

    for (const [route, permission] of Object.entries(routePermissions)) {
      if (path.startsWith(route)) {
        return hasPermission(permission.resource, permission.action);
      }
    }

    return true;
  };

  return (
    <DevAuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        updateUser,
        hasPermission,
        canAccess,
        quickLogin,
        isDevMode: true,
      }}
    >
      {children}
    </DevAuthContext.Provider>
  );
};

export const useDevAuth = () => {
  const context = useContext(DevAuthContext);
  if (!context) {
    throw new Error('useDevAuth must be used within a DevAuthProvider');
  }
  return context;
};