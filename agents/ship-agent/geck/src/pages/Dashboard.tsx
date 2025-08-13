import React, { useState, useEffect } from 'react';
import { FileJson, Database, Activity, Clock, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useTheme } from '../themes/ThemeContext';
import { Card, CardHeader, CardContent } from '../components/ui/Card';

export const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    contexts: 0,
    programs: 0,
    recentSync: 'Never',
    systemHealth: 'checking...',
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.dashboard.getStats();
      
      // Format last sync time
      let syncTime = 'Never';
      if (data.lastSync) {
        const syncDate = new Date(data.lastSync);
        const now = new Date();
        const diffMs = now.getTime() - syncDate.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diffHours > 24) {
          syncTime = `${Math.floor(diffHours / 24)} days ago`;
        } else if (diffHours > 0) {
          syncTime = `${diffHours} hours ago`;
        } else if (diffMins > 0) {
          syncTime = `${diffMins} minutes ago`;
        } else {
          syncTime = 'Just now';
        }
      }
      
      setStats({
        contexts: data.contexts,
        programs: data.programs,
        recentSync: syncTime,
        systemHealth: data.systemHealth.database,
      });
      
      setRecentActivity(data.recentActivity || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const getHealthIcon = (health: string) => {
    if (health === 'connected' || health === 'healthy') {
      return <CheckCircle size={20} style={{ color: theme.colors.success }} />;
    } else if (health === 'checking...') {
      return <RefreshCw size={20} className="animate-spin" style={{ color: theme.colors.warning }} />;
    } else {
      return <AlertCircle size={20} style={{ color: theme.colors.danger }} />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'context':
        return <FileJson size={16} style={{ color: theme.colors.primary }} />;
      case 'program':
        return <Database size={16} style={{ color: theme.colors.info }} />;
      case 'sync':
        return <RefreshCw size={16} style={{ color: theme.colors.warning }} />;
      default:
        return <Activity size={16} style={{ color: theme.colors.primary }} />;
    }
  };

  const statCardStyles: React.CSSProperties = {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    border: `2px solid ${theme.colors.border}`,
    borderRadius: theme.borders.radius.lg,
    transition: theme.effects.transition.base,
    textDecoration: 'none',
    display: 'block',
  };

  const statCardHoverStyles: React.CSSProperties = {
    backgroundColor: theme.colors.surfaceHover,
    borderColor: theme.colors.primary,
    transform: 'translateY(-2px)',
    boxShadow: theme.effects.shadow.md,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: theme.colors.text }}>
            System Dashboard
          </h1>
          <p style={{ color: theme.colors.textMuted }}>
            Welcome to the GECK Configuration Manager
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all ${
            loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
          }`}
          style={{
            backgroundColor: theme.colors.primaryBackground,
            border: `2px solid ${theme.colors.primaryBorder}`,
            color: theme.colors.primary,
          }}
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div 
          className="mb-6 p-4 rounded flex items-center gap-3"
          style={{
            backgroundColor: `${theme.colors.danger}20`,
            border: `1px solid ${theme.colors.danger}`,
            color: theme.colors.danger,
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link
          to="/contexts"
          style={statCardStyles}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, statCardHoverStyles)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, statCardStyles)}
        >
          <div className="flex items-center justify-between mb-3">
            <FileJson size={32} style={{ color: theme.colors.primary }} />
            <span 
              className="text-2xl font-bold"
              style={{ color: theme.colors.text }}
            >
              {loading ? '...' : stats.contexts}
            </span>
          </div>
          <h3 className="font-semibold" style={{ color: theme.colors.text }}>
            Contexts
          </h3>
          <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
            Configuration contexts
          </p>
        </Link>

        <Link
          to="/programs"
          style={statCardStyles}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, statCardHoverStyles)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, statCardStyles)}
        >
          <div className="flex items-center justify-between mb-3">
            <Database size={32} style={{ color: theme.colors.secondary }} />
            <span 
              className="text-2xl font-bold"
              style={{ color: theme.colors.text }}
            >
              {loading ? '...' : stats.programs}
            </span>
          </div>
          <h3 className="font-semibold" style={{ color: theme.colors.text }}>
            Programs
          </h3>
          <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
            Automation programs
          </p>
        </Link>

        <Link
          to="/sync"
          style={statCardStyles}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, statCardHoverStyles)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, statCardStyles)}
        >
          <div className="flex items-center justify-between mb-3">
            <Clock size={32} style={{ color: theme.colors.info }} />
            <span 
              className="text-sm font-medium"
              style={{ color: theme.colors.text }}
            >
              {loading ? '...' : stats.recentSync}
            </span>
          </div>
          <h3 className="font-semibold" style={{ color: theme.colors.text }}>
            Last Sync
          </h3>
          <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
            Postman synchronization
          </p>
        </Link>

        <div style={statCardStyles}>
          <div className="flex items-center justify-between mb-3">
            {getHealthIcon(stats.systemHealth)}
            <span 
              className="text-sm font-medium"
              style={{ 
                color: stats.systemHealth === 'connected' ? theme.colors.success : theme.colors.warning 
              }}
            >
              {loading ? 'Checking...' : stats.systemHealth}
            </span>
          </div>
          <h3 className="font-semibold" style={{ color: theme.colors.text }}>
            System Health
          </h3>
          <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
            Database connection
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>
              Recent Activity
            </h2>
            <span className="text-sm" style={{ color: theme.colors.textMuted }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8" style={{ color: theme.colors.textMuted }}>
              <RefreshCw size={32} className="animate-spin mx-auto mb-3" />
              <p>Loading activity...</p>
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8" style={{ color: theme.colors.textMuted }}>
              <Activity size={32} className="mx-auto mb-3 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded transition-all"
                  style={{
                    backgroundColor: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
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
                  {getActivityIcon(activity.type)}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium" style={{ color: theme.colors.text }}>
                          {activity.name}
                        </span>
                        <span className="ml-2 text-sm" style={{ 
                          color: activity.action === 'created' ? theme.colors.success :
                                 activity.action === 'deleted' ? theme.colors.danger :
                                 activity.action === 'synced' ? theme.colors.info :
                                 theme.colors.textMuted 
                        }}>
                          {activity.action === 'created' ? '• Created' : 
                           activity.action === 'modified' ? '• Modified' :
                           activity.action === 'deleted' ? '• Deleted' :
                           activity.action === 'synced' ? '• Synced' : `• ${activity.action}`}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                        {new Date(activity.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {activity.type && (
                      <div className="mt-1 text-sm" style={{ color: theme.colors.textSecondary }}>
                        Type: {activity.type === 'context' ? 'Customer Context' : 
                               activity.type === 'program' ? 'Program Configuration' :
                               activity.type === 'sync' ? 'Synchronization' : activity.type}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};