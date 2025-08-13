import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Edit, Copy, Trash2, FileJson, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { CustomerContext } from '../types';
import { VaultSearch } from '../components/VaultInput';

export const ContextsPage: React.FC = () => {
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
        <h1 className="text-3xl font-bold text-vault-green terminal-glow">
          Customer Contexts
        </h1>
        <div className="flex space-x-3">
          <button
            onClick={fetchContexts}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-3 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <Link
            to="/contexts/new"
            className="flex items-center space-x-2 px-6 py-3 bg-vault-green/20 text-vault-green border border-vault-green/50 rounded-lg hover:bg-vault-green/30 transition-colors"
          >
            <Plus size={20} />
            <span>New Context</span>
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <VaultSearch
          placeholder="Search contexts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Contexts Grid */}
      {loading && !error ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-vault-green" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContexts.map((context) => (
            <div
              key={context._id}
              className="bg-gray-900 rounded-lg border border-gray-800 hover:border-vault-green/50 transition-all p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <FileJson className="text-vault-yellow" size={24} />
                <div className="flex space-x-2">
                  <Link
                    to={`/contexts/${context._id}`}
                    className="p-2 text-gray-400 hover:text-vault-green transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </Link>
                  <button
                    onClick={() => handleDuplicate(context._id!)}
                    className="p-2 text-gray-400 hover:text-vault-blue transition-colors"
                    title="Duplicate"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(context._id!)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-2">{context.customer?.name || context.name || 'Unnamed Context'}</h3>
              <p className="text-sm text-gray-400 mb-4">{context.customer?.entity || ''}</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Industry:</span>
                  <span className="text-gray-300">{context.customer?.industry || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span className="text-gray-300">{context.customer?.type || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Version:</span>
                  <span className="text-gray-300">{context.version || '1.0.0'}</span>
                </div>
                {context.customer?.contacts && context.customer.contacts.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Contacts:</span>
                    <span className="text-gray-300">{context.customer.contacts.length}</span>
                  </div>
                )}
              </div>

              {context.tags && context.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {context.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500">
                Updated {context.updatedAt ? new Date(context.updatedAt).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredContexts.length === 0 && (
        <div className="text-center py-12">
          <FileJson className="mx-auto text-gray-700 mb-4" size={48} />
          <p className="text-gray-500">No contexts found</p>
        </div>
      )}
    </div>
  );
};