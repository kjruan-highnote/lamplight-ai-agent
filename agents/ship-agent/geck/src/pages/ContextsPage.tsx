import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Edit, Copy, Trash2, FileJson, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { CustomerContext } from '../types';
import { useTheme } from '../themes/ThemeContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';

export const ContextsPage: React.FC = () => {
  const { theme } = useTheme();
  const [contexts, setContexts] = useState<CustomerContext[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContexts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.contexts.list();
      setContexts(data);
    } catch (err) {
      console.error('Failed to fetch contexts:', err);
      setError('Failed to load contexts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContexts();
  }, []);

  const filteredContexts = contexts.filter(context => {
    const searchLower = searchTerm.toLowerCase();
    return (
      context.name?.toLowerCase().includes(searchLower) ||
      context.customer?.name?.toLowerCase().includes(searchLower) ||
      context.customer?.industry?.toLowerCase().includes(searchLower) ||
      context.customer?.entity?.toLowerCase().includes(searchLower)
    );
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this context?')) {
      try {
        await api.contexts.delete(id);
        await fetchContexts();
      } catch (err) {
        console.error('Failed to delete context:', err);
        alert('Failed to delete context');
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    const context = contexts.find(c => c._id === id);
    if (context) {
      const newName = prompt('Enter name for duplicated context:', `${context.name}_copy`);
      if (newName) {
        try {
          await api.contexts.duplicate(id, newName);
          await fetchContexts();
        } catch (err) {
          console.error('Failed to duplicate context:', err);
          alert('Failed to duplicate context');
        }
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold" style={{ 
          color: theme.colors.text,
          textShadow: theme.id === 'vault-tec' ? theme.effects.customEffects?.textGlow : 'none'
        }}>
          Customer Contexts
        </h1>
        <div className="flex gap-3">
          <Button
            onClick={fetchContexts}
            disabled={loading}
            variant="secondary"
            icon={<RefreshCw size={20} className={loading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
          <Link to="/contexts/new">
            <Button
              variant="primary"
              icon={<Plus size={20} />}
            >
              New Context
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div 
          className="mb-6 p-4 rounded-lg flex items-center gap-3"
          style={{
            backgroundColor: `${theme.colors.danger}20`,
            border: `1px solid ${theme.colors.danger}`,
            color: theme.colors.danger,
          }}
        >
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          placeholder="Search contexts by name, customer, industry, or entity..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          icon={<Search size={20} />}
        />
      </div>

      {/* Contexts Grid */}
      {loading && !error ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw 
            className="animate-spin" 
            size={32} 
            style={{ color: theme.colors.primary }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContexts.map((context) => (
            <Card
              key={context._id}
              variant="bordered"
              className="relative group"
            >
              <CardContent>
                <div className="flex justify-between items-start mb-4">
                  <FileJson size={24} style={{ color: theme.colors.warning }} />
                  <div className="flex gap-1">
                    <Link
                      to={`/contexts/${context._id}`}
                      className="p-2 rounded transition-all"
                      style={{ 
                        color: theme.colors.textMuted,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = theme.colors.primary;
                        e.currentTarget.style.backgroundColor = theme.colors.primaryBackground;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = theme.colors.textMuted;
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Edit"
                    >
                      <Edit size={16} />
                    </Link>
                    <button
                      onClick={() => handleDuplicate(context._id!)}
                      className="p-2 rounded transition-all"
                      style={{ 
                        color: theme.colors.textMuted,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = theme.colors.info;
                        e.currentTarget.style.backgroundColor = theme.colors.secondaryBackground;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = theme.colors.textMuted;
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(context._id!)}
                      className="p-2 rounded transition-all"
                      style={{ 
                        color: theme.colors.textMuted,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = theme.colors.danger;
                        e.currentTarget.style.backgroundColor = `${theme.colors.danger}20`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = theme.colors.textMuted;
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                  {context.customer?.name || context.name || 'Unnamed Context'}
                </h3>
                <p className="text-sm mb-4" style={{ color: theme.colors.textSecondary }}>
                  {context.customer?.entity || 'No entity specified'}
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: theme.colors.textMuted }}>Industry:</span>
                    <span style={{ color: theme.colors.textSecondary }}>
                      {context.customer?.industry || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: theme.colors.textMuted }}>Type:</span>
                    <span style={{ color: theme.colors.textSecondary }}>
                      {context.customer?.type || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: theme.colors.textMuted }}>Version:</span>
                    <span style={{ color: theme.colors.textSecondary }}>
                      {context.version || '1.0.0'}
                    </span>
                  </div>
                  {context.customer?.contacts && context.customer.contacts.length > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: theme.colors.textMuted }}>Contacts:</span>
                      <span style={{ color: theme.colors.textSecondary }}>
                        {context.customer.contacts.length}
                      </span>
                    </div>
                  )}
                </div>

                {context.tags && context.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {context.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs rounded"
                        style={{
                          backgroundColor: theme.colors.secondaryBackground,
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div 
                  className="mt-4 pt-4 text-xs"
                  style={{ 
                    borderTop: `1px solid ${theme.colors.border}`,
                    color: theme.colors.textMuted 
                  }}
                >
                  Updated {context.updatedAt ? new Date(context.updatedAt).toLocaleDateString() : 'N/A'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredContexts.length === 0 && (
        <div className="text-center py-12">
          <FileJson 
            className="mx-auto mb-4 opacity-50" 
            size={48}
            style={{ color: theme.colors.textMuted }}
          />
          <p style={{ color: theme.colors.textMuted }}>
            {searchTerm ? 'No contexts match your search' : 'No contexts found'}
          </p>
          {!searchTerm && (
            <Link to="/contexts/new">
              <Button variant="primary" className="mt-4">
                Create First Context
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
};