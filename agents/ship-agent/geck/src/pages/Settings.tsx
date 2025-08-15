import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../themes/ThemeContext';
import { Card, CardContent } from '../components/ui/Card';
import { 
  Settings as SettingsIcon, 
  Palette, 
  Database, 
  Shield, 
  Bell, 
  Key, 
  Globe,
  Users,
  Terminal,
  ChevronRight,
  Zap,
  HardDrive
} from 'lucide-react';

interface SettingCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  badge?: string;
  disabled: boolean;
}

export const Settings: React.FC = () => {
  const { theme } = useTheme();

  const settingsCategories: SettingCategory[] = [
    {
      id: 'themes',
      title: 'Themes & Appearance',
      description: 'Customize the look and feel of your GECK interface',
      icon: Palette,
      path: '/settings/themes',
      badge: theme.name,
      disabled: false,
    },
    {
      id: 'database',
      title: 'Database Configuration',
      description: 'MongoDB connection settings and performance tuning',
      icon: Database,
      path: '/settings/database',
      disabled: true,
    },
    {
      id: 'api',
      title: 'API & Integrations',
      description: 'Configure Highnote API, webhooks, and external services',
      icon: Globe,
      path: '/settings/api',
      disabled: false,
    },
    {
      id: 'security',
      title: 'Security & Authentication',
      description: 'Manage access controls, API keys, and encryption',
      icon: Shield,
      path: '/settings/security',
      disabled: true,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Configure alerts, email settings, and event triggers',
      icon: Bell,
      path: '/settings/notifications',
      disabled: true,
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Manage users, roles, and permissions',
      icon: Users,
      path: '/settings/users',
      disabled: true,
    },
    {
      id: 'automation',
      title: 'Automation Rules',
      description: 'Set up automated workflows and scheduled tasks',
      icon: Zap,
      path: '/settings/automation',
      disabled: true,
    },
    {
      id: 'backup',
      title: 'Backup & Recovery',
      description: 'Configure automatic backups and disaster recovery',
      icon: HardDrive,
      path: '/settings/backup',
      disabled: true,
    },
    {
      id: 'developer',
      title: 'Developer Options',
      description: 'Advanced settings, debugging tools, and console access',
      icon: Terminal,
      path: '/settings/developer',
      disabled: true,
    },
  ];

  const cardStyles = (disabled: boolean): React.CSSProperties => ({
    padding: theme.spacing.lg,
    backgroundColor: disabled ? theme.colors.surface : theme.colors.surface,
    border: `2px solid ${theme.colors.border}`,
    borderRadius: theme.borders.radius.lg,
    transition: theme.effects.transition.base,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    textDecoration: 'none',
    display: 'block',
    position: 'relative' as const,
  });

  const cardHoverStyles: React.CSSProperties = {
    backgroundColor: theme.colors.surfaceHover,
    borderColor: theme.colors.primary,
    transform: 'translateY(-2px)',
    boxShadow: theme.effects.shadow.md,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon size={32} style={{ color: theme.colors.primary }} />
        <div>
          <h1 className="text-3xl font-bold" style={{ color: theme.colors.text }}>
            Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
            Configure and customize your GECK installation
          </p>
        </div>
      </div>

      {/* System Status */}
      <Card variant="bordered">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                System Status
              </h3>
              <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                All systems operational
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold" style={{ color: theme.colors.success }}>
                  ● Online
                </div>
                <div style={{ color: theme.colors.textMuted }}>Database</div>
              </div>
              <div className="text-center">
                <div className="font-semibold" style={{ color: theme.colors.success }}>
                  ● Active
                </div>
                <div style={{ color: theme.colors.textMuted }}>API</div>
              </div>
              <div className="text-center">
                <div className="font-semibold" style={{ color: theme.colors.primary }}>
                  v2.77
                </div>
                <div style={{ color: theme.colors.textMuted }}>Version</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settingsCategories.map((category) => {
          const Icon = category.icon;
          
          if (category.disabled) {
            return (
              <div
                key={category.id}
                style={cardStyles(category.disabled)}
              >
                <div className="flex items-start justify-between mb-3">
                  <Icon size={24} style={{ color: theme.colors.textMuted }} />
                  <span 
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: theme.colors.secondaryBackground,
                      color: theme.colors.textMuted,
                    }}
                  >
                    Coming Soon
                  </span>
                </div>
                
                <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                  {category.title}
                </h3>
                
                <p className="text-sm mb-3" style={{ color: theme.colors.textMuted }}>
                  {category.description}
                </p>
              </div>
            );
          }
          
          return (
            <Link
              key={category.id}
              to={category.path}
              style={cardStyles(category.disabled)}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, cardHoverStyles);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surface;
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <Icon size={24} style={{ color: theme.colors.primary }} />
                <ChevronRight size={20} style={{ color: theme.colors.textMuted }} />
              </div>
              
              <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                {category.title}
              </h3>
              
              <p className="text-sm mb-3" style={{ color: theme.colors.textMuted }}>
                {category.description}
              </p>

              {category.badge && (
                <div 
                  className="inline-block text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: theme.colors.primaryBackground,
                    color: theme.colors.primary,
                    border: `1px solid ${theme.colors.primaryBorder}`,
                  }}
                >
                  {category.badge}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card variant="bordered">
        <CardContent>
          <h3 className="font-semibold mb-4" style={{ color: theme.colors.text }}>
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <button
              className="text-left p-3 rounded transition-all"
              style={{
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                e.currentTarget.style.borderColor = theme.colors.borderHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surface;
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              <Key size={16} style={{ color: theme.colors.primary, marginBottom: '0.5rem' }} />
              <div className="text-sm font-medium">Reset API Keys</div>
            </button>
            
            <button
              className="text-left p-3 rounded transition-all"
              style={{
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                e.currentTarget.style.borderColor = theme.colors.borderHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surface;
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              <Database size={16} style={{ color: theme.colors.primary, marginBottom: '0.5rem' }} />
              <div className="text-sm font-medium">Clear Cache</div>
            </button>
            
            <button
              className="text-left p-3 rounded transition-all"
              style={{
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                color: theme.colors.text,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                e.currentTarget.style.borderColor = theme.colors.borderHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surface;
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              <HardDrive size={16} style={{ color: theme.colors.primary, marginBottom: '0.5rem' }} />
              <div className="text-sm font-medium">Export Config</div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};