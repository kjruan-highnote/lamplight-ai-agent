import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Database, FileJson, Cpu, GitBranch, Settings, Home, Code2, LogOut, User } from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/', icon: Home, label: 'DASHBOARD' },
    { path: '/contexts', icon: FileJson, label: 'CONTEXTS' },
    { path: '/programs', icon: Database, label: 'PROGRAMS' },
    { path: '/operations', icon: Code2, label: 'OPERATIONS' },
    { path: '/solution', icon: Cpu, label: 'GENERATOR' },
    { path: '/sync', icon: GitBranch, label: 'SYNC' },
    { path: '/settings', icon: Settings, label: 'SETTINGS' },
  ];

  const layoutStyles: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.typography.fontFamily.mono,
  };

  const headerStyles: React.CSSProperties = {
    backgroundColor: theme.colors.surface,
    borderBottom: `2px solid ${theme.colors.border}`,
    position: 'relative' as const,
    overflow: 'hidden',
  };

  const sidebarStyles: React.CSSProperties = {
    width: '16rem',
    backgroundColor: theme.colors.surface,
    borderRight: `2px solid ${theme.colors.border}`,
    minHeight: 'calc(100vh - 80px)',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  };

  const navButtonStyles = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `${theme.borders.width.thin} solid`,
    borderColor: isActive ? theme.colors.primary : theme.colors.border,
    backgroundColor: isActive ? theme.colors.primaryBackground : 'transparent',
    color: isActive ? theme.colors.primary : theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.mono,
    fontSize: theme.typography.fontSize.sm,
    transition: theme.effects.transition.base,
    textDecoration: 'none',
    borderRadius: theme.borders.radius.md,
  });

  const navButtonHoverStyles: React.CSSProperties = {
    backgroundColor: theme.colors.surfaceHover,
    borderColor: theme.colors.borderHover,
    color: theme.colors.text,
  };

  return (
    <div style={layoutStyles}>
      {/* Header */}
      <header style={headerStyles}>
        {theme.id === 'vault-tec' && (
          <div className="absolute inset-0 bg-scanlines opacity-30"></div>
        )}
        <div className="px-6 py-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div 
                className={theme.id === 'vault-tec' ? "text-4xl font-terminal animate-glow" : "text-4xl font-bold"}
                style={{ 
                  color: theme.colors.primary,
                  fontFamily: theme.typography.fontFamily.display,
                  textShadow: theme.effects.customEffects?.textGlow || 'none'
                }}
              >
                G.E.C.K.
              </div>
              <div 
                className="text-sm"
                style={{ 
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.fontFamily.mono 
                }}
              >
                CONFIGURATION SYSTEM v2.77
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* User Info */}
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-sm" style={{ color: theme.colors.text }}>
                      {user.name}
                    </div>
                    <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                      {user.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                  </div>
                  <div 
                    className="flex items-center justify-center"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: theme.borders.radius.full || '50%',
                      backgroundColor: theme.colors.primaryBackground,
                      border: `2px solid ${theme.colors.primary}`,
                      color: theme.colors.primary,
                    }}
                  >
                    <User size={20} />
                  </div>
                  <button
                    onClick={async () => {
                      await logout();
                      navigate('/login');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: theme.spacing.xs,
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.colors.danger}`,
                      borderRadius: theme.borders.radius.md,
                      color: theme.colors.danger,
                      fontSize: theme.typography.fontSize.xs,
                      fontFamily: theme.typography.fontFamily.mono,
                      cursor: 'pointer',
                      transition: theme.effects.transition.base,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${theme.colors.danger}20`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <LogOut size={14} />
                    LOGOUT
                  </button>
                </div>
              )}
              
              {/* Status */}
              <div className="flex items-center space-x-2 text-xs" style={{ color: theme.colors.textMuted }}>
                <span>STATUS: </span>
                <span style={{ color: theme.colors.success }} className="animate-pulse">● ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav style={sidebarStyles}>
          {theme.id === 'vault-tec' && (
            <div className="absolute inset-0 bg-scanlines opacity-10"></div>
          )}
          
          {/* Menu Items */}
          <div className="flex-1 p-4 space-y-1 relative">
            <div 
              className="text-xs mb-4 px-4"
              style={{ 
                color: theme.colors.textMuted,
                fontFamily: theme.typography.fontFamily.display 
              }}
            >
              ═══ MAIN MENU ═══
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={navButtonStyles(isActive)}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      Object.assign(e.currentTarget.style, navButtonHoverStyles);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {isActive && <span className="ml-auto text-xs animate-pulse">▶</span>}
                </Link>
              );
            })}
          </div>
          
          {/* Footer Status */}
          <div 
            className="relative p-4"
            style={{ 
              borderTop: `1px solid ${theme.colors.border}` 
            }}
          >
            <div className="text-xs space-y-1" style={{ color: theme.colors.textMuted }}>
              <div>{theme.id === 'vault-tec' ? 'VAULT 111' : theme.name.toUpperCase()}</div>
              <div>TERMINAL {theme.id === 'vault-tec' ? '42' : '01'}</div>
              {user && (
                <div style={{ fontFamily: theme.typography.fontFamily.display }}>
                  USER: {user.name.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6 relative">
          {theme.id === 'vault-tec' && (
            <div className="absolute inset-0 bg-scanlines opacity-5"></div>
          )}
          <div className="relative">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};