import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Save, Eye, EyeOff, FileJson, AlertCircle, Check } from 'lucide-react';
import { api } from '../lib/api';
import { CustomerContext } from '../types';

export const ContextEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [context, setContext] = useState<CustomerContext>({
    name: '',
    customer: '',
    version: '1.0.0',
    data: {
      customer_name: '',
      industry: '',
      company_size: '',
      business_model: '',
      current_challenges: [],
      technical_requirements: {
        integration_complexity: '',
        security_requirements: '',
        compliance_needs: [],
        scalability_needs: '',
      },
      business_objectives: [],
      success_metrics: [],
      implementation_timeline: '',
      budget_range: '',
      stakeholders: [],
    },
    tags: [],
  });
  
  const [jsonContent, setJsonContent] = useState('');
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (id && id !== 'new') {
      loadContext();
    } else {
      setJsonContent(JSON.stringify(context.data, null, 2));
    }
  }, [id]);

  const loadContext = async () => {
    try {
      const data = await api.contexts.get(id!);
      setContext(data);
      setJsonContent(JSON.stringify(data.data, null, 2));
    } catch (err) {
      setError('Failed to load context');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // If in JSON mode, parse and update context data
      if (viewMode === 'json') {
        try {
          const parsedData = JSON.parse(jsonContent);
          context.data = parsedData;
        } catch (e) {
          setError('Invalid JSON format');
          setSaving(false);
          return;
        }
      }

      if (id && id !== 'new') {
        await api.contexts.update(id, context);
        setSuccess('Context updated successfully');
      } else {
        const result = await api.contexts.create(context);
        setSuccess('Context created successfully');
        // Navigate to the edit page for the new context
        navigate(`/contexts/${result._id}`, { replace: true });
      }
    } catch (err) {
      setError('Failed to save context');
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setContext(prev => {
      const updated = { ...prev };
      const keys = field.split('.');
      let current: any = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return updated;
    });
    
    // Update JSON view
    setJsonContent(JSON.stringify(context.data, null, 2));
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 border-2 border-vault-green/50 bg-vault-terminal p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-terminal text-vault-green animate-flicker">
              ▶ {id === 'new' ? 'NEW CONTEXT' : 'EDIT CONTEXT'}
            </h1>
            {context.name && (
              <div className="text-xs text-vault-green/50 mt-1">{context.name}</div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setViewMode(viewMode === 'form' ? 'json' : 'form')}
              className="vault-button px-4 py-2 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-sm hover:bg-vault-green/20 hover:border-vault-green transition-all flex items-center space-x-2"
            >
              {viewMode === 'form' ? <FileJson size={16} /> : <Eye size={16} />}
              <span>{viewMode === 'form' ? 'JSON' : 'FORM'}</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="vault-button px-6 py-2 bg-vault-green/20 border border-vault-green text-vault-green font-mono text-sm hover:bg-vault-green/30 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              <Save size={16} />
              <span>{saving ? 'SAVING...' : 'SAVE'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 text-red-400 flex items-center space-x-2">
          <AlertCircle size={16} />
          <span className="text-sm font-mono">{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-vault-green/10 border border-vault-green/50 text-vault-green flex items-center space-x-2">
          <Check size={16} />
          <span className="text-sm font-mono">{success}</span>
        </div>
      )}

      {/* Editor Content */}
      <div className="border-2 border-vault-green/30 bg-vault-surface">
        {viewMode === 'form' ? (
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-vault-green/50 mb-2 font-terminal">CONTEXT NAME</label>
                <input
                  type="text"
                  value={context.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                />
              </div>
              <div>
                <label className="block text-xs text-vault-green/50 mb-2 font-terminal">CUSTOMER</label>
                <input
                  type="text"
                  value={context.customer}
                  onChange={(e) => handleFormChange('customer', e.target.value)}
                  className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                />
              </div>
            </div>

            {/* Customer Data */}
            <div className="space-y-4">
              <div className="text-xs text-vault-green/50 font-terminal">═══ CUSTOMER INFORMATION ═══</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-vault-green/50 mb-2">COMPANY NAME</label>
                  <input
                    type="text"
                    value={context.data.customer_name}
                    onChange={(e) => handleFormChange('data.customer_name', e.target.value)}
                    className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                  />
                </div>
                <div>
                  <label className="block text-xs text-vault-green/50 mb-2">INDUSTRY</label>
                  <input
                    type="text"
                    value={context.data.industry}
                    onChange={(e) => handleFormChange('data.industry', e.target.value)}
                    className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-vault-green/50 mb-2">COMPANY SIZE</label>
                  <select
                    value={context.data.company_size}
                    onChange={(e) => handleFormChange('data.company_size', e.target.value)}
                    className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                  >
                    <option value="">Select size...</option>
                    <option value="Startup (1-50)">Startup (1-50)</option>
                    <option value="Small (51-200)">Small (51-200)</option>
                    <option value="Medium (201-1000)">Medium (201-1000)</option>
                    <option value="Large (1001-5000)">Large (1001-5000)</option>
                    <option value="Enterprise (5000+)">Enterprise (5000+)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-vault-green/50 mb-2">BUSINESS MODEL</label>
                  <input
                    type="text"
                    value={context.data.business_model}
                    onChange={(e) => handleFormChange('data.business_model', e.target.value)}
                    className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                  />
                </div>
              </div>
            </div>

            {/* Note about additional fields */}
            <div className="p-4 bg-vault-terminal border border-vault-green/30">
              <p className="text-xs text-vault-green/70 font-mono">
                ▶ Switch to JSON mode to edit all fields including technical requirements, objectives, and stakeholders
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[600px]">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={jsonContent}
              onChange={(value) => setJsonContent(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'Share Tech Mono, monospace',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};