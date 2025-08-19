import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthState, ROLE_PERMISSIONS, UserRole } from '../types';
import { api } from '../lib/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  hasPermission: (resource: string, action: string) => boolean;
  canAccess: (path: string) => boolean;
  quickLogin?: (role: UserRole) => void;
  isDevMode?: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Development mode check
const isDevelopment = process.env.NODE_ENV === 'development';
const useDevAuth = process.env.REACT_APP_USE_DEV_AUTH === 'true';

// Mock users for development
const DEV_USERS: Record<string, User> = {
  engineer: {
    _id: 'dev-engineer-001',
    email: 'engineer@dev.local',
    name: 'Dev Engineer',
    role: 'technical_implementation_engineer',
    isActive: true,
    permissions: ROLE_PERMISSIONS.technical_implementation_engineer,
    department: 'Engineering',
  },
  solutions: {
    _id: 'dev-solutions-001',
    email: 'solutions@dev.local',
    name: 'Dev Solutions',
    role: 'solutions_engineer',
    isActive: true,
    permissions: ROLE_PERMISSIONS.solutions_engineer,
    department: 'Solutions',
  },
  admin: {
    _id: 'dev-admin-001',
    email: 'admin@dev.local',
    name: 'Dev Admin',
    role: 'admin',
    isActive: true,
    permissions: ROLE_PERMISSIONS.admin,
    department: 'Administration',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Check for existing session on mount
  useEffect(() => {
    if (isDevelopment && useDevAuth) {
      // In dev mode with dev auth, auto-login if configured
      const autoLoginRole = process.env.REACT_APP_DEV_AUTO_LOGIN;
      if (autoLoginRole && DEV_USERS[autoLoginRole]) {
        setAuthState({
          user: DEV_USERS[autoLoginRole],
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      checkSession();
    }
  }, []);

  const checkSession = async () => {
    try {
      const token = localStorage.getItem('geck-auth-token');
      if (token) {
        // Verify token with backend
        const user = await api.auth.verifyToken(token);
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Session check failed:', error);
      localStorage.removeItem('geck-auth-token');
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  };

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    
    // Development mode with mock auth
    if (isDevelopment && useDevAuth) {
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
      
      let user: User | null = null;
      if (email.includes('admin')) {
        user = DEV_USERS.admin;
      } else if (email.includes('solution')) {
        user = DEV_USERS.solutions;
      } else {
        user = DEV_USERS.engineer; // Default to engineer
      }
      
      setAuthState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return;
    }
    
    // Production mode with real auth
    try {
      const { user, token } = await api.auth.login(email, password);
      
      // Apply role permissions
      const userWithPermissions = {
        ...user,
        permissions: user.permissions || ROLE_PERMISSIONS[user.role],
      };
      
      localStorage.setItem('geck-auth-token', token);
      
      setAuthState({
        user: userWithPermissions,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error.message || 'Login failed',
      });
      throw error;
    }
  };
  
  const quickLogin = useCallback((role: UserRole) => {
    if (!isDevelopment || !useDevAuth) return;
    
    const userKey = role === 'technical_implementation_engineer' ? 'engineer' : 
                    role === 'solutions_engineer' ? 'solutions' : 'admin';
    const user = DEV_USERS[userKey];
    
    setAuthState({
      user,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  }, []);

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('geck-auth-token');
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  };

  const updateUser = (updates: Partial<User>) => {
    setAuthState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updates } : null,
    }));
  };

  const hasPermission = useCallback((resource: string, action: string): boolean => {
    if (!authState.user) return false;
    
    const permissions = authState.user.permissions;
    
    // Check specific resource permissions
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
  }, [authState.user]);

  const canAccess = useCallback((path: string): boolean => {
    if (!authState.user) return false;
    
    // Define route permissions
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

    // Check if path requires specific permission
    for (const [route, permission] of Object.entries(routePermissions)) {
      if (path.startsWith(route)) {
        return hasPermission(permission.resource, permission.action);
      }
    }

    // Default allow for undefined routes
    return true;
  }, [authState.user, hasPermission]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        updateUser,
        hasPermission,
        canAccess,
        quickLogin: isDevelopment && useDevAuth ? quickLogin : undefined,
        isDevMode: isDevelopment && useDevAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component for protected routes
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission?: { resource: string; action: string }
): React.FC<P> => {
  return (props: P) => {
    const { isAuthenticated, hasPermission, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg text-red-500">Please log in to access this page</div>
        </div>
      );
    }

    if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg text-red-500">You don't have permission to access this page</div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};