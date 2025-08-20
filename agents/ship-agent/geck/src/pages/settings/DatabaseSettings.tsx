import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Server, Activity, AlertCircle, Check, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useTheme } from '../../themes/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';

interface DatabaseConfig {
  uri: string;
  database: string;
  maxPoolSize: number;
  minPoolSize: number;
  connectionTimeout: number;
  retryWrites: boolean;
  retryReads: boolean;
}

interface DatabaseStats {
  status: 'connected' | 'disconnected' | 'error';
  collections: number;
  documents: number;
  size: string;
  lastBackup?: string;
  uptime?: string;
}

export const DatabaseSettings: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [config, setConfig] = useState<DatabaseConfig>({
    uri: '',
    database: 'geck',
    maxPoolSize: 10,
    minPoolSize: 2,
    connectionTimeout: 10000,
    retryWrites: true,
    retryReads: true,
  });
  
  const [stats, setStats] = useState<DatabaseStats>({
    status: 'connected',
    collections: 4,
    documents: 1250,
    size: '12.5 MB',
    lastBackup: '2024-01-15T10:30:00Z',
    uptime: '15 days, 3 hours',
  });
  
  const [showUri, setShowUri] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check permissions - admin only
  const canAccessDatabase = user?.role === 'admin';

  useEffect(() => {
    if (!canAccessDatabase) {
      navigate('/settings');
    }
  }, [canAccessDatabase, navigate]);

  const handleTestConnection = async () => {
    setTesting(true);
    // Simulate connection test
    setTimeout(() => {
      setTesting(false);
      setStats(prev => ({ ...prev, status: 'connected' }));
    }, 2000);
  };

  const handleCopyUri = () => {
    if (config.uri) {
      navigator.clipboard.writeText(config.uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Here you would save the config to the backend
      console.log('Saving database config:', config);
      // await api.settings.updateDatabase(config);
      setTimeout(() => {
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Failed to save database config:', error);
      setLoading(false);
    }
  };

  const getStatusColor = () => {
    switch (stats.status) {
      case 'connected':
        return theme.colors.success;
      case 'disconnected':
        return theme.colors.warning || theme.colors.textMuted;
      case 'error':
        return theme.colors.danger;
      default:
        return theme.colors.textMuted;
    }
  };

  const getStatusIcon = () => {
    switch (stats.status) {
      case 'connected':
        return <Check size={16} />;
      case 'error':
        return <AlertCircle size={16} />;
      default:
        return <Activity size={16} />;
    }
  };

  if (!canAccessDatabase) {
    return null;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{ 
          fontSize: theme.typography.fontSize['2xl'],
          color: theme.colors.primary,
          marginBottom: theme.spacing.xs,
          fontFamily: theme.typography.fontFamily.display
        }}>
          DATABASE CONFIGURATION
        </h1>
        <p style={{ 
          color: theme.colors.textMuted,
          fontSize: theme.typography.fontSize.sm 
        }}>
          Configure MongoDB connection settings and monitor database performance
        </p>
      </div>

      {/* Connection Status */}
      <Card style={{ marginBottom: theme.spacing.lg }}>
        <div style={{ padding: theme.spacing.lg }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: theme.spacing.md
          }}>
            <h2 style={{ 
              fontSize: theme.typography.fontSize.lg,
              color: theme.colors.text,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm
            }}>
              <Server size={20} style={{ color: theme.colors.primary }} />
              Connection Status
            </h2>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={16} />}
              onClick={handleTestConnection}
              loading={testing}
            >
              Test Connection
            </Button>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: theme.spacing.md
          }}>
            <div>
              <div style={{ 
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.textMuted,
                marginBottom: theme.spacing.xs
              }}>
                Status
              </div>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.xs,
                color: getStatusColor()
              }}>
                {getStatusIcon()}
                <span style={{ textTransform: 'capitalize' }}>{stats.status}</span>
              </div>
            </div>
            <div>
              <div style={{ 
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.textMuted,
                marginBottom: theme.spacing.xs
              }}>
                Collections
              </div>
              <div style={{ color: theme.colors.text }}>{stats.collections}</div>
            </div>
            <div>
              <div style={{ 
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.textMuted,
                marginBottom: theme.spacing.xs
              }}>
                Documents
              </div>
              <div style={{ color: theme.colors.text }}>{stats.documents.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ 
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.textMuted,
                marginBottom: theme.spacing.xs
              }}>
                Database Size
              </div>
              <div style={{ color: theme.colors.text }}>{stats.size}</div>
            </div>
            {stats.uptime && (
              <div>
                <div style={{ 
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.textMuted,
                  marginBottom: theme.spacing.xs
                }}>
                  Uptime
                </div>
                <div style={{ color: theme.colors.text }}>{stats.uptime}</div>
              </div>
            )}
            {stats.lastBackup && (
              <div>
                <div style={{ 
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.textMuted,
                  marginBottom: theme.spacing.xs
                }}>
                  Last Backup
                </div>
                <div style={{ color: theme.colors.text }}>
                  {new Date(stats.lastBackup).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Connection Settings */}
      <Card style={{ marginBottom: theme.spacing.lg }}>
        <div style={{ padding: theme.spacing.lg }}>
          <h2 style={{ 
            fontSize: theme.typography.fontSize.lg,
            color: theme.colors.text,
            marginBottom: theme.spacing.md,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm
          }}>
            <Database size={20} style={{ color: theme.colors.primary }} />
            Connection Settings
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: theme.spacing.xs,
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.textSecondary
              }}>
                MongoDB URI
              </label>
              <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                <Input
                  type={showUri ? 'text' : 'password'}
                  value={config.uri}
                  onChange={(e) => setConfig({ ...config, uri: e.target.value })}
                  placeholder="mongodb+srv://username:password@cluster.mongodb.net"
                  style={{ flex: 1 }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={showUri ? <EyeOff size={16} /> : <Eye size={16} />}
                  onClick={() => setShowUri(!showUri)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy size={16} />}
                  onClick={handleCopyUri}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <p style={{ 
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.textMuted,
                marginTop: theme.spacing.xs
              }}>
                Connection string for MongoDB Atlas or local MongoDB instance
              </p>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: theme.spacing.xs,
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.textSecondary
              }}>
                Database Name
              </label>
              <Input
                value={config.database}
                onChange={(e) => setConfig({ ...config, database: e.target.value })}
                placeholder="geck"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: theme.spacing.xs,
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.textSecondary
                }}>
                  Max Pool Size
                </label>
                <Input
                  type="number"
                  value={config.maxPoolSize}
                  onChange={(e) => setConfig({ ...config, maxPoolSize: parseInt(e.target.value) || 10 })}
                  min={1}
                  max={100}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: theme.spacing.xs,
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.textSecondary
                }}>
                  Min Pool Size
                </label>
                <Input
                  type="number"
                  value={config.minPoolSize}
                  onChange={(e) => setConfig({ ...config, minPoolSize: parseInt(e.target.value) || 2 })}
                  min={0}
                  max={50}
                />
              </div>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: theme.spacing.xs,
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.textSecondary
              }}>
                Connection Timeout (ms)
              </label>
              <Input
                type="number"
                value={config.connectionTimeout}
                onChange={(e) => setConfig({ ...config, connectionTimeout: parseInt(e.target.value) || 10000 })}
                min={1000}
                step={1000}
              />
            </div>

            <div style={{ display: 'flex', gap: theme.spacing.lg }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={config.retryWrites}
                  onChange={(e) => setConfig({ ...config, retryWrites: e.target.checked })}
                  style={{ 
                    width: '16px', 
                    height: '16px',
                    accentColor: theme.colors.primary
                  }}
                />
                <span style={{ fontSize: theme.typography.fontSize.sm }}>Retry Writes</span>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.sm,
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={config.retryReads}
                  onChange={(e) => setConfig({ ...config, retryReads: e.target.checked })}
                  style={{ 
                    width: '16px', 
                    height: '16px',
                    accentColor: theme.colors.primary
                  }}
                />
                <span style={{ fontSize: theme.typography.fontSize.sm }}>Retry Reads</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Warning Notice */}
      <Card style={{ 
        marginBottom: theme.spacing.lg,
        backgroundColor: `${theme.colors.warning || theme.colors.primary}10`,
        border: `1px solid ${theme.colors.warning || theme.colors.primary}40`
      }}>
        <div style={{ 
          padding: theme.spacing.md,
          display: 'flex',
          gap: theme.spacing.sm
        }}>
          <AlertCircle size={20} style={{ 
            color: theme.colors.warning || theme.colors.primary,
            flexShrink: 0,
            marginTop: '2px'
          }} />
          <div>
            <div style={{ 
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text,
              marginBottom: theme.spacing.xs,
              fontWeight: 'bold'
            }}>
              Important Notice
            </div>
            <div style={{ 
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.textMuted
            }}>
              Changing database configuration requires a server restart and may cause temporary service interruption. 
              Make sure to backup your data before making any changes to production database settings.
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
        <Button
          variant="secondary"
          onClick={() => navigate('/settings')}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={loading}
        >
          Save Configuration
        </Button>
      </div>
    </div>
  );
};