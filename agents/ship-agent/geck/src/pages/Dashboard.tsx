import React, { useState, useEffect } from 'react';
import { FileJson, Database, Activity, Clock, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export const Dashboard: React.FC = () => {
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
      
      // Format recent activity
      const formattedActivity = data.recentActivity.map(item => {
        const timestamp = new Date(item.timestamp);
        const now = new Date();
        const diffMs = now.getTime() - timestamp.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeStr = '';
        if (diffHours > 0) {
          timeStr = `${diffHours.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}:00`;
        } else {
          const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
          timeStr = `00:${diffMins.toString().padStart(2, '0')}:${diffSecs.toString().padStart(2, '0')}`;
        }
        
        return {
          ...item,
          action: item.action.toUpperCase(),
          time: timeStr,
        };
      });
      
      setRecentActivity(formattedActivity);
      setLastRefresh(new Date());
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="mb-8 border-2 border-vault-green/50 bg-vault-terminal p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-terminal text-vault-green animate-flicker">
              ▶ SYSTEM STATUS OVERVIEW
            </h1>
            <div className="text-xs text-vault-green/50 mt-1">
              LAST UPDATE: {lastRefresh.toISOString()}
            </div>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-4 py-2 bg-vault-surface border-2 border-vault-green/50 text-vault-green hover:bg-vault-green/20 transition-all flex items-center space-x-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="text-xs font-terminal">REFRESH</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border-2 border-red-500/50 text-red-400">
          <div className="flex items-center space-x-2">
            <AlertCircle size={20} />
            <span className="font-terminal">{error}</span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-vault-surface border-2 border-vault-green/30 p-4 hover:border-vault-green transition-all hover:shadow-lg hover:shadow-vault-green/20">
          <div className="text-xs text-vault-green/50 mb-2">[ CONTEXTS ]</div>
          <div className="text-3xl font-terminal text-vault-green animate-flicker">{stats.contexts.toString().padStart(2, '0')}</div>
          <div className="text-xs text-vault-green/70 mt-2">CUSTOMER PROFILES LOADED</div>
        </div>

        <div className="bg-vault-surface border-2 border-vault-green/30 p-4 hover:border-vault-green transition-all hover:shadow-lg hover:shadow-vault-green/20">
          <div className="text-xs text-vault-green/50 mb-2">[ PROGRAMS ]</div>
          <div className="text-3xl font-terminal text-vault-green animate-flicker">{stats.programs.toString().padStart(2, '0')}</div>
          <div className="text-xs text-vault-green/70 mt-2">CONFIGURATIONS ACTIVE</div>
        </div>

        <div className="bg-vault-surface border-2 border-vault-green/30 p-4 hover:border-vault-green transition-all hover:shadow-lg hover:shadow-vault-green/20">
          <div className="text-xs text-vault-green/50 mb-2">[ LAST SYNC ]</div>
          <div className="text-xl font-terminal text-vault-green animate-flicker">{stats.recentSync.toUpperCase()}</div>
          <div className="text-xs text-vault-green/70 mt-2">POSTMAN COLLECTIONS</div>
        </div>

        <div className={`bg-vault-surface border-2 p-4 transition-all hover:shadow-lg ${
          stats.systemHealth === 'connected' 
            ? 'border-vault-green/30 hover:border-vault-green hover:shadow-vault-green/20' 
            : 'border-red-500/30 hover:border-red-500 hover:shadow-red-500/20'
        }`}>
          <div className={`text-xs mb-2 ${
            stats.systemHealth === 'connected' ? 'text-vault-green/50' : 'text-red-500/50'
          }`}>[ SYSTEM ]</div>
          <div className={`flex items-center space-x-2 ${
            stats.systemHealth === 'connected' ? 'text-vault-green' : 'text-red-500'
          }`}>
            {stats.systemHealth === 'connected' ? (
              <CheckCircle size={24} className="animate-flicker" />
            ) : (
              <AlertCircle size={24} className="animate-pulse" />
            )}
            <span className="text-sm font-terminal uppercase">{stats.systemHealth}</span>
          </div>
          <div className={`text-xs mt-2 ${
            stats.systemHealth === 'connected' ? 'text-vault-green/70' : 'text-red-500/70'
          }`}>DATABASE STATUS</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="text-xs text-vault-green/50 mb-4 font-terminal">═══ QUICK ACTIONS ═══</div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/contexts/new"
            className="vault-button px-6 py-3 bg-vault-surface border-2 border-vault-green/50 text-vault-green font-mono text-sm hover:bg-vault-green/20 hover:border-vault-green transition-all hover:shadow-lg hover:shadow-vault-green/20"
          >
            [+] NEW CONTEXT
          </Link>
          <Link
            to="/programs/new"
            className="vault-button px-6 py-3 bg-vault-surface border-2 border-vault-green/50 text-vault-green font-mono text-sm hover:bg-vault-green/20 hover:border-vault-green transition-all hover:shadow-lg hover:shadow-vault-green/20"
          >
            [+] NEW PROGRAM
          </Link>
          <Link
            to="/solution"
            className="vault-button px-6 py-3 bg-vault-surface border-2 border-vault-blue/50 text-vault-blue font-mono text-sm hover:bg-vault-blue/20 hover:border-vault-blue transition-all hover:shadow-lg hover:shadow-vault-blue/20"
          >
            [▶] GENERATE
          </Link>
          <button
            className="vault-button px-6 py-3 bg-vault-surface border-2 border-vault-amber/50 text-vault-amber font-mono text-sm hover:bg-vault-amber/20 hover:border-vault-amber transition-all hover:shadow-lg hover:shadow-vault-amber/20"
          >
            [⟲] SYNC DATA
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="text-xs text-vault-green/50 mb-4 font-terminal">═══ ACTIVITY LOG ═══</div>
        <div className="bg-vault-surface border-2 border-vault-green/30">
          {loading && recentActivity.length === 0 ? (
            <div className="p-8 text-center">
              <RefreshCw className="animate-spin text-vault-green mx-auto mb-2" size={24} />
              <p className="text-xs text-vault-green/50 font-terminal">LOADING ACTIVITY...</p>
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="p-8 text-center">
              <Activity className="text-vault-green/30 mx-auto mb-2" size={32} />
              <p className="text-xs text-vault-green/50 font-terminal">NO RECENT ACTIVITY</p>
            </div>
          ) : (
            <div className="p-4 font-mono text-sm">
              {recentActivity.map((item, index) => (
                <div key={item._id || index} className="flex items-center justify-between py-2 border-b border-vault-green/20 last:border-0 hover:bg-vault-green/5 px-2 -mx-2">
                  <div className="flex items-center space-x-4">
                    <span className={`text-xs
                      ${item.type === 'context' ? 'text-vault-amber' : ''}
                      ${item.type === 'program' ? 'text-vault-blue' : ''}
                      ${item.type === 'sync' ? 'text-vault-green' : ''}
                      ${item.type === 'system' ? 'text-vault-yellow' : ''}
                    `}>
                      {item.type === 'context' && '[CTX]'}
                      {item.type === 'program' && '[PRG]'}
                      {item.type === 'sync' && '[SYN]'}
                      {item.type === 'system' && '[SYS]'}
                    </span>
                    <span className="text-vault-green">{item.name}</span>
                    <span className="text-vault-green/50">→</span>
                    <span className={`text-vault-green/70 ${
                      item.action === 'CREATED' ? 'text-vault-blue' : ''
                    } ${
                      item.action === 'DELETED' ? 'text-red-500' : ''
                    }`}>{item.action}</span>
                  </div>
                  <span className="text-xs text-vault-green/40 font-terminal">{item.time}</span>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-vault-green/20 text-xs text-vault-green/40">
                <span className="animate-pulse">▶</span> END OF LOG - {recentActivity.length} ENTRIES
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};