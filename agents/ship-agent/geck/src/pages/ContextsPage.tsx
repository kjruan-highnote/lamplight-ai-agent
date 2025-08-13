import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Edit, Copy, Trash2, FileJson } from 'lucide-react';

export const ContextsPage: React.FC = () => {
  const [contexts, setContexts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock data - will be replaced with API calls
  useEffect(() => {
    setContexts([
      {
        _id: '1',
        name: 'triplink_context_v2',
        customer: 'TripLink',
        version: '2.0.0',
        data: {
          customer_name: 'Trip.com International',
          industry: 'Travel & Hospitality',
          company_size: 'Enterprise (10,000+ employees)',
        },
        updatedAt: new Date('2024-01-10'),
        tags: ['production', 'ap_automation'],
      },
      {
        _id: '2',
        name: 'consumer_prepaid_context',
        customer: 'Generic Consumer',
        version: '1.0.0',
        data: {
          customer_name: 'Consumer Prepaid Program',
          industry: 'Financial Services',
          company_size: 'Varies',
        },
        updatedAt: new Date('2024-01-08'),
        tags: ['template', 'prepaid'],
      },
    ]);
  }, []);

  const filteredContexts = contexts.filter(context =>
    context.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    context.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    context.data.industry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this context?')) {
      // API call to delete
      setContexts(contexts.filter(c => c._id !== id));
    }
  };

  const handleDuplicate = async (id: string) => {
    // API call to duplicate
    const context = contexts.find(c => c._id === id);
    if (context) {
      const newContext = {
        ...context,
        _id: Date.now().toString(),
        name: `${context.name}_copy`,
        updatedAt: new Date(),
      };
      setContexts([...contexts, newContext]);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-vault-green terminal-glow">
          Customer Contexts
        </h1>
        <Link
          to="/contexts/new"
          className="flex items-center space-x-2 px-6 py-3 bg-vault-green/20 text-vault-green border border-vault-green/50 rounded-lg hover:bg-vault-green/30 transition-colors"
        >
          <Plus size={20} />
          <span>New Context</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search contexts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-vault-green/50"
          />
        </div>
      </div>

      {/* Contexts Grid */}
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
                  onClick={() => handleDuplicate(context._id)}
                  className="p-2 text-gray-400 hover:text-vault-blue transition-colors"
                  title="Duplicate"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => handleDelete(context._id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-2">{context.customer}</h3>
            <p className="text-sm text-gray-400 mb-4">{context.name}</p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Industry:</span>
                <span className="text-gray-300">{context.data.industry}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Company Size:</span>
                <span className="text-gray-300">{context.data.company_size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Version:</span>
                <span className="text-gray-300">{context.version}</span>
              </div>
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
              Updated {new Date(context.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {filteredContexts.length === 0 && (
        <div className="text-center py-12">
          <FileJson className="mx-auto text-gray-700 mb-4" size={48} />
          <p className="text-gray-500">No contexts found</p>
        </div>
      )}
    </div>
  );
};