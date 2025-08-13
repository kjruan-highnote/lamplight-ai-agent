import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Database, FileJson, Cpu, GitBranch, Settings, Home } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'DASHBOARD' },
    { path: '/contexts', icon: FileJson, label: 'CONTEXTS' },
    { path: '/programs', icon: Database, label: 'PROGRAMS' },
    { path: '/solution', icon: Cpu, label: 'GENERATOR' },
    { path: '/sync', icon: GitBranch, label: 'SYNC' },
    { path: '/settings', icon: Settings, label: 'SETTINGS' },
  ];

  return (
    <div className="min-h-screen bg-vault-bg text-vault-green font-mono">
      {/* Header */}
      <header className="bg-vault-terminal border-b-2 border-vault-green/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-scanlines opacity-30"></div>
        <div className="px-6 py-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-vault-green text-4xl font-terminal animate-glow">
                G.E.C.K.
              </div>
              <div className="text-sm text-vault-green/70 font-mono">
                VAULT-TEC CONFIGURATION SYSTEM v2.77
              </div>
            </div>
            <div className="flex items-center space-x-2 text-xs text-vault-green/50">
              <span>STATUS: </span>
              <span className="text-vault-green animate-pulse">● ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-vault-surface border-r-2 border-vault-green/30 min-h-[calc(100vh-80px)] relative flex flex-col">
          <div className="absolute inset-0 bg-scanlines opacity-10"></div>
          
          {/* Menu Items */}
          <div className="flex-1 p-4 space-y-1 relative">
            <div className="text-xs text-vault-green/50 mb-4 px-4 font-terminal">
              ═══ MAIN MENU ═══
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    vault-button flex items-center space-x-3 px-4 py-3 border transition-all font-mono text-sm
                    ${isActive 
                      ? 'bg-vault-green/20 text-vault-green border-vault-green shadow-lg shadow-vault-green/30' 
                      : 'text-vault-green/70 border-vault-green/30 hover:bg-vault-green/10 hover:text-vault-green hover:border-vault-green/50'
                    }
                  `}
                >
                  <Icon size={18} />
                  <span className="terminal-text">{item.label}</span>
                  {isActive && <span className="ml-auto text-xs animate-pulse">▶</span>}
                </Link>
              );
            })}
          </div>
          
          {/* Footer Status - Now outside the scrollable area */}
          <div className="relative p-4 border-t border-vault-green/30">
            <div className="text-xs text-vault-green/40 space-y-1">
              <div>VAULT 111</div>
              <div>TERMINAL 42</div>
              <div className="font-terminal">USER: OVERSEER</div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6 relative">
          <div className="absolute inset-0 bg-scanlines opacity-5"></div>
          <div className="relative">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};