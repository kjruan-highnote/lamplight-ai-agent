import React from 'react';
import { FileJson, Database, Activity, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  // Mock data - will be replaced with API calls
  const stats = {
    contexts: 12,
    programs: 8,
    recentSync: '2 hours ago',
    pendingChanges: 3,
  };

  const recentActivity = [
    { type: 'context', name: 'TripLink Context v2', action: 'MODIFIED', time: '00:10:00' },
    { type: 'program', name: 'AP Automation', action: 'CREATED', time: '01:00:00' },
    { type: 'sync', name: 'Postman Collections', action: 'SYNCED', time: '02:00:00' },
    { type: 'context', name: 'Consumer Prepaid', action: 'CREATED', time: '03:00:00' },
  ];

  return (
    <div>
      <div className="mb-8 border-2 border-vault-green/50 bg-vault-terminal p-4">
        <h1 className="text-2xl font-terminal text-vault-green animate-flicker">
          ▶ SYSTEM STATUS OVERVIEW
        </h1>
        <div className="text-xs text-vault-green/50 mt-1">LAST UPDATE: {new Date().toISOString()}</div>
      </div>

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

        <div className="bg-vault-surface border-2 border-vault-amber/30 p-4 hover:border-vault-amber transition-all hover:shadow-lg hover:shadow-vault-amber/20">
          <div className="text-xs text-vault-amber/50 mb-2">[ PENDING ]</div>
          <div className="text-3xl font-terminal text-vault-amber animate-flicker">{stats.pendingChanges.toString().padStart(2, '0')}</div>
          <div className="text-xs text-vault-amber/70 mt-2">UNCOMMITTED CHANGES</div>
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
          <div className="p-4 font-mono text-sm">
            {recentActivity.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-vault-green/20 last:border-0 hover:bg-vault-green/5 px-2 -mx-2">
                <div className="flex items-center space-x-4">
                  <span className={`text-xs
                    ${item.type === 'context' ? 'text-vault-amber' : ''}
                    ${item.type === 'program' ? 'text-vault-blue' : ''}
                    ${item.type === 'sync' ? 'text-vault-green' : ''}
                  `}>
                    {item.type === 'context' && '[CTX]'}
                    {item.type === 'program' && '[PRG]'}
                    {item.type === 'sync' && '[SYN]'}
                  </span>
                  <span className="text-vault-green">{item.name}</span>
                  <span className="text-vault-green/50">→</span>
                  <span className="text-vault-green/70">{item.action}</span>
                </div>
                <span className="text-xs text-vault-green/40 font-terminal">{item.time}</span>
              </div>
            ))}
            <div className="mt-4 pt-4 border-t border-vault-green/20 text-xs text-vault-green/40">
              <span className="animate-pulse">▶</span> END OF LOG
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};