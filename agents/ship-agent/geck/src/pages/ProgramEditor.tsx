import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Save, Eye, FileCode, AlertCircle, Check, Plus, Trash2, 
  Package, Users, Upload, Download, Settings, Shield, 
  Zap, Globe, Book, ChevronDown, ChevronRight 
} from 'lucide-react';
import { api } from '../lib/api';
import { ProgramConfig, Category, Operation, Workflow, Entity, CustomerContext } from '../types';
import * as yaml from 'js-yaml';

type TabType = 'general' | 'workflows' | 'operations' | 'compliance' | 'integration' | 'yaml';

export const ProgramEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [program, setProgram] = useState<ProgramConfig>({
    program_type: '',
    vendor: '',
    version: '1.0.0',
    api_type: 'graphql',
    program_class: 'template',
    metadata: {
      name: '',
      description: '',
      base_url: '{{apiUrl}}',
      authentication: {
        type: 'Basic',
        header: 'Authorization',
      },
    },
    capabilities: [],
    workflows: {},
    entities: [],
    categories: [],
    tags: [],
    status: 'draft',
  });
  
  const [yamlContent, setYamlContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [contexts, setContexts] = useState<CustomerContext[]>([]);
  const [templates, setTemplates] = useState<ProgramConfig[]>([]);

  useEffect(() => {
    fetchContextsAndTemplates();
    if (id && id !== 'new') {
      loadProgram();
    } else {
      updateYamlContent();
    }
  }, [id]);

  const fetchContextsAndTemplates = async () => {
    try {
      const [contextsData, programsData] = await Promise.all([
        api.contexts.list(),
        api.programs.list()
      ]);
      setContexts(contextsData);
      setTemplates(programsData.filter(p => p.program_class === 'template'));
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const loadProgram = async () => {
    try {
      const data = await api.programs.get(id!);
      setProgram(data);
      updateYamlContent(data);
    } catch (err) {
      setError('Failed to load program');
      console.error(err);
    }
  };

  const updateYamlContent = (programData = program) => {
    try {
      const yamlObj = {
        program_type: programData.program_type,
        vendor: programData.vendor,
        version: programData.version,
        api_type: programData.api_type,
        metadata: programData.metadata,
        capabilities: programData.capabilities,
        workflows: programData.workflows,
        entities: programData.entities,
        categories: programData.categories,
        compliance: programData.compliance,
        integrations: programData.integrations,
        performance: programData.performance,
        resources: programData.resources,
      };
      setYamlContent(yaml.dump(yamlObj, { indent: 2 }));
    } catch (err) {
      console.error('Failed to convert to YAML:', err);
    }
  };

  const handleYamlChange = (value: string | undefined) => {
    setYamlContent(value || '');
    try {
      const parsed = yaml.load(value || '') as any;
      setProgram(prev => ({
        ...prev,
        ...parsed,
      }));
      setError('');
    } catch (err) {
      setError('Invalid YAML format');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (id && id !== 'new') {
        await api.programs.update(id, program);
        setSuccess('Program updated successfully');
      } else {
        const result = await api.programs.create(program);
        setSuccess('Program created successfully');
        setTimeout(() => navigate(`/programs/${result._id}`), 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const addCapability = () => {
    const capability = prompt('Enter capability name:');
    if (capability) {
      setProgram(prev => ({
        ...prev,
        capabilities: [...(prev.capabilities || []), capability]
      }));
      updateYamlContent();
    }
  };

  const removeCapability = (index: number) => {
    setProgram(prev => ({
      ...prev,
      capabilities: prev.capabilities?.filter((_, i) => i !== index) || []
    }));
    updateYamlContent();
  };

  const addWorkflow = () => {
    const name = prompt('Enter workflow key (e.g., card_issuance):');
    if (name) {
      setProgram(prev => ({
        ...prev,
        workflows: {
          ...prev.workflows,
          [name]: {
            name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: '',
            required: false,
            steps: []
          }
        }
      }));
      updateYamlContent();
    }
  };

  const addCategory = () => {
    const name = prompt('Enter category key (e.g., initialization):');
    if (name) {
      setProgram(prev => ({
        ...prev,
        categories: [
          ...(prev.categories || []),
          {
            name,
            display_name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: '',
            order: (prev.categories?.length || 0) + 1,
            operations: []
          }
        ]
      }));
      updateYamlContent();
    }
  };

  const addOperation = (categoryIndex: number) => {
    const name = prompt('Enter operation name:');
    if (name) {
      setProgram(prev => {
        const newCategories = [...(prev.categories || [])];
        newCategories[categoryIndex].operations.push({
          name,
          type: 'query',
          required: false,
          description: ''
        });
        return { ...prev, categories: newCategories };
      });
      updateYamlContent();
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-vault-green terminal-glow">
            {id === 'new' ? 'Create Program' : 'Edit Program'}
          </h1>
          <p className="text-sm text-vault-green/50 mt-2">
            {program.program_class === 'template' ? (
              <span className="flex items-center space-x-2">
                <Package size={16} />
                <span>Program Template</span>
              </span>
            ) : program.program_class === 'subscriber' ? (
              <span className="flex items-center space-x-2">
                <Users size={16} />
                <span>Subscriber Implementation</span>
              </span>
            ) : (
              'Configure program settings and operations'
            )}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate('/programs')}
            className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2 bg-vault-green/20 text-vault-green border border-vault-green/50 rounded-lg hover:bg-vault-green/30 transition-colors disabled:opacity-50"
          >
            <Save size={20} />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 flex items-center space-x-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-500/50 rounded-lg text-green-400 flex items-center space-x-2">
          <Check size={20} />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-900 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded transition-colors flex items-center space-x-2 ${
            activeTab === 'general'
              ? 'bg-vault-green/20 text-vault-green'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Settings size={16} />
          <span>General</span>
        </button>
        <button
          onClick={() => setActiveTab('workflows')}
          className={`px-4 py-2 rounded transition-colors flex items-center space-x-2 ${
            activeTab === 'workflows'
              ? 'bg-vault-green/20 text-vault-green'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Zap size={16} />
          <span>Workflows</span>
        </button>
        <button
          onClick={() => setActiveTab('operations')}
          className={`px-4 py-2 rounded transition-colors flex items-center space-x-2 ${
            activeTab === 'operations'
              ? 'bg-vault-green/20 text-vault-green'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Globe size={16} />
          <span>Operations</span>
        </button>
        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-4 py-2 rounded transition-colors flex items-center space-x-2 ${
            activeTab === 'compliance'
              ? 'bg-vault-green/20 text-vault-green'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Shield size={16} />
          <span>Compliance</span>
        </button>
        <button
          onClick={() => setActiveTab('integration')}
          className={`px-4 py-2 rounded transition-colors flex items-center space-x-2 ${
            activeTab === 'integration'
              ? 'bg-vault-green/20 text-vault-green'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Zap size={16} />
          <span>Integration</span>
        </button>
        <button
          onClick={() => setActiveTab('yaml')}
          className={`px-4 py-2 rounded transition-colors flex items-center space-x-2 ${
            activeTab === 'yaml'
              ? 'bg-vault-green/20 text-vault-green'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <FileCode size={16} />
          <span>YAML</span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Program Type Selection */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Program Class
                </label>
                <select
                  value={program.program_class || 'template'}
                  onChange={(e) => setProgram(prev => ({ 
                    ...prev, 
                    program_class: e.target.value as 'template' | 'subscriber' 
                  }))}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-vault-green/50"
                >
                  <option value="template">Template (Reusable)</option>
                  <option value="subscriber">Subscriber (Customer-specific)</option>
                </select>
              </div>

              {program.program_class === 'subscriber' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Customer Context
                  </label>
                  <select
                    value={program.customer_id || ''}
                    onChange={(e) => setProgram(prev => ({ ...prev, customer_id: e.target.value }))}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-vault-green/50"
                  >
                    <option value="">Select Customer</option>
                    {contexts.map(ctx => (
                      <option key={ctx._id} value={ctx._id}>
                        {ctx.customer?.name || ctx.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Program Type
                </label>
                <input
                  type="text"
                  value={program.program_type}
                  onChange={(e) => setProgram(prev => ({ ...prev, program_type: e.target.value }))}
                  placeholder="e.g., ap_automation"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-vault-green/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Vendor
                </label>
                <input
                  type="text"
                  value={program.vendor}
                  onChange={(e) => setProgram(prev => ({ ...prev, vendor: e.target.value }))}
                  placeholder="e.g., Highnote Inc."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-vault-green/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Version
                </label>
                <input
                  type="text"
                  value={program.version}
                  onChange={(e) => setProgram(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0.0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-vault-green/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Type
                </label>
                <select
                  value={program.api_type}
                  onChange={(e) => setProgram(prev => ({ ...prev, api_type: e.target.value as any }))}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-vault-green/50"
                >
                  <option value="graphql">GraphQL</option>
                  <option value="rest">REST</option>
                  <option value="soap">SOAP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={program.status || 'draft'}
                  onChange={(e) => setProgram(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-vault-green/50"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-vault-green">Metadata</h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={program.metadata?.name || ''}
                  onChange={(e) => setProgram(prev => ({ 
                    ...prev, 
                    metadata: { ...prev.metadata, name: e.target.value } 
                  }))}
                  placeholder="Program display name"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-vault-green/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={program.metadata?.description || ''}
                  onChange={(e) => setProgram(prev => ({ 
                    ...prev, 
                    metadata: { ...prev.metadata, description: e.target.value } 
                  }))}
                  placeholder="Program description"
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-vault-green/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Base URL
                </label>
                <input
                  type="text"
                  value={program.metadata?.base_url || ''}
                  onChange={(e) => setProgram(prev => ({ 
                    ...prev, 
                    metadata: { ...prev.metadata, base_url: e.target.value } 
                  }))}
                  placeholder="https://api.example.com/graphql"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-vault-green/50"
                />
              </div>
            </div>

            {/* Capabilities */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-vault-green">Capabilities</h3>
                <button
                  onClick={addCapability}
                  className="flex items-center space-x-1 px-3 py-1 bg-vault-green/20 text-vault-green border border-vault-green/50 rounded hover:bg-vault-green/30 transition-colors text-sm"
                >
                  <Plus size={16} />
                  <span>Add</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {program.capabilities?.map((cap, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-2 px-3 py-1 bg-gray-800 rounded"
                  >
                    <span className="text-sm text-gray-300">{cap}</span>
                    <button
                      onClick={() => removeCapability(idx)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(!program.capabilities || program.capabilities.length === 0) && (
                  <span className="text-gray-500 text-sm">No capabilities defined</span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workflows' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-vault-green">Workflows</h3>
              <button
                onClick={addWorkflow}
                className="flex items-center space-x-1 px-3 py-1 bg-vault-green/20 text-vault-green border border-vault-green/50 rounded hover:bg-vault-green/30 transition-colors text-sm"
              >
                <Plus size={16} />
                <span>Add Workflow</span>
              </button>
            </div>
            
            {Object.entries(program.workflows || {}).map(([key, workflow]) => (
              <div key={key} className="border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={workflow.name}
                      onChange={(e) => {
                        setProgram(prev => ({
                          ...prev,
                          workflows: {
                            ...prev.workflows,
                            [key]: { ...workflow, name: e.target.value }
                          }
                        }));
                      }}
                      className="text-lg font-medium bg-transparent border-b border-gray-700 focus:border-vault-green/50 outline-none text-gray-200 mb-2"
                    />
                    <textarea
                      value={workflow.description}
                      onChange={(e) => {
                        setProgram(prev => ({
                          ...prev,
                          workflows: {
                            ...prev.workflows,
                            [key]: { ...workflow, description: e.target.value }
                          }
                        }));
                      }}
                      placeholder="Workflow description"
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-300 text-sm"
                    />
                  </div>
                  <label className="flex items-center space-x-2 ml-4">
                    <input
                      type="checkbox"
                      checked={workflow.required}
                      onChange={(e) => {
                        setProgram(prev => ({
                          ...prev,
                          workflows: {
                            ...prev.workflows,
                            [key]: { ...workflow, required: e.target.checked }
                          }
                        }));
                      }}
                      className="rounded border-gray-700"
                    />
                    <span className="text-sm text-gray-400">Required</span>
                  </label>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm text-gray-400">Steps:</div>
                  {workflow.steps?.map((step, idx) => (
                    <div key={idx} className="flex items-center space-x-2 pl-4">
                      <span className="text-sm text-gray-300">{idx + 1}.</span>
                      <input
                        type="text"
                        value={step.operation}
                        onChange={(e) => {
                          const newSteps = [...(workflow.steps || [])];
                          newSteps[idx] = { ...step, operation: e.target.value };
                          setProgram(prev => ({
                            ...prev,
                            workflows: {
                              ...prev.workflows,
                              [key]: { ...workflow, steps: newSteps }
                            }
                          }));
                        }}
                        className="flex-1 px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300"
                        placeholder="Operation name"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {Object.keys(program.workflows || {}).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No workflows defined. Click "Add Workflow" to create one.
              </div>
            )}
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-vault-green">Operation Categories</h3>
              <button
                onClick={addCategory}
                className="flex items-center space-x-1 px-3 py-1 bg-vault-green/20 text-vault-green border border-vault-green/50 rounded hover:bg-vault-green/30 transition-colors text-sm"
              >
                <Plus size={16} />
                <span>Add Category</span>
              </button>
            </div>
            
            {program.categories?.map((category, catIdx) => (
              <div key={catIdx} className="border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={category.display_name}
                      onChange={(e) => {
                        const newCategories = [...(program.categories || [])];
                        newCategories[catIdx] = { ...category, display_name: e.target.value };
                        setProgram(prev => ({ ...prev, categories: newCategories }));
                      }}
                      className="text-lg font-medium bg-transparent border-b border-gray-700 focus:border-vault-green/50 outline-none text-gray-200"
                    />
                    <span className="text-sm text-gray-500">Order: {category.order}</span>
                  </div>
                  <button
                    onClick={() => addOperation(catIdx)}
                    className="flex items-center space-x-1 px-2 py-1 bg-gray-800 text-gray-400 rounded hover:text-vault-green transition-colors text-sm"
                  >
                    <Plus size={14} />
                    <span>Add Operation</span>
                  </button>
                </div>
                
                <div className="space-y-2">
                  {category.operations?.map((op, opIdx) => (
                    <div key={opIdx} className="flex items-center space-x-3 pl-4">
                      <span className={`text-xs px-2 py-1 rounded ${
                        op.type === 'mutation' ? 'bg-vault-amber/20 text-vault-amber' : 'bg-vault-blue/20 text-vault-blue'
                      }`}>
                        {op.type.toUpperCase()}
                      </span>
                      <input
                        type="text"
                        value={op.name}
                        onChange={(e) => {
                          const newCategories = [...(program.categories || [])];
                          newCategories[catIdx].operations[opIdx] = { ...op, name: e.target.value };
                          setProgram(prev => ({ ...prev, categories: newCategories }));
                        }}
                        className="flex-1 px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300"
                      />
                      <label className="flex items-center space-x-1">
                        <input
                          type="checkbox"
                          checked={op.required}
                          onChange={(e) => {
                            const newCategories = [...(program.categories || [])];
                            newCategories[catIdx].operations[opIdx] = { ...op, required: e.target.checked };
                            setProgram(prev => ({ ...prev, categories: newCategories }));
                          }}
                          className="rounded border-gray-700"
                        />
                        <span className="text-xs text-gray-500">Required</span>
                      </label>
                    </div>
                  ))}
                  {category.operations?.length === 0 && (
                    <div className="text-sm text-gray-500 pl-4">No operations in this category</div>
                  )}
                </div>
              </div>
            ))}
            
            {(!program.categories || program.categories.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No operation categories defined. Click "Add Category" to create one.
              </div>
            )}
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-vault-green">Compliance & Security</h3>
            <div className="text-gray-400 text-sm">
              Configure compliance standards, regulations, and security requirements for this program.
            </div>
            {/* Add compliance configuration UI here */}
          </div>
        )}

        {activeTab === 'integration' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-vault-green">Integration Requirements</h3>
            <div className="text-gray-400 text-sm">
              Configure webhooks, reporting, and other integration requirements.
            </div>
            {/* Add integration configuration UI here */}
          </div>
        )}

        {activeTab === 'yaml' && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <div className="text-sm text-gray-400">
                Edit the raw YAML configuration. Changes will be reflected in the form view.
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const blob = new Blob([yamlContent], { type: 'text/yaml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${program.program_type || 'program'}.yaml`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center space-x-1 px-3 py-1 bg-gray-800 text-gray-400 rounded hover:text-vault-green transition-colors text-sm"
                >
                  <Download size={14} />
                  <span>Export</span>
                </button>
                <label className="flex items-center space-x-1 px-3 py-1 bg-gray-800 text-gray-400 rounded hover:text-vault-green transition-colors text-sm cursor-pointer">
                  <Upload size={14} />
                  <span>Import</span>
                  <input
                    type="file"
                    accept=".yaml,.yml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const content = evt.target?.result as string;
                          handleYamlChange(content);
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <Editor
              height="600px"
              defaultLanguage="yaml"
              value={yamlContent}
              onChange={handleYamlChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};