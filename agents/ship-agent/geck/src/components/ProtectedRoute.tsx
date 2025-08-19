import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../themes/ThemeContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: {
    resource: string;
    action: string;
  };
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission 
}) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.typography.fontFamily.mono,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: theme.typography.fontSize.lg,
            marginBottom: theme.spacing.md,
            color: theme.colors.primary,
          }}>
            LOADING...
          </div>
          <div className="animate-pulse" style={{ color: theme.colors.textMuted }}>
            Verifying access credentials
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission.resource, requiredPermission.action)) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 200px)',
        padding: theme.spacing.xl,
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '500px',
        }}>
          <div style={{ 
            fontSize: theme.typography.fontSize['2xl'],
            color: theme.colors.danger,
            marginBottom: theme.spacing.md,
            fontFamily: theme.typography.fontFamily.display,
          }}>
            ACCESS DENIED
          </div>
          <div style={{ 
            fontSize: theme.typography.fontSize.base,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.lg,
          }}>
            You don't have permission to access this resource.
          </div>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borders.radius.md,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textMuted,
            fontFamily: theme.typography.fontFamily.mono,
          }}>
            Required: {requiredPermission.resource.toUpperCase()}.{requiredPermission.action.toUpperCase()}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};