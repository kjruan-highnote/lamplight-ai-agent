import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Save, Eye, FileCode, AlertCircle, Check, Plus, Trash2, 
  Package, Users, Upload, Download, Settings, Shield, 
  Zap, Globe, Book, ChevronDown, ChevronRight, Maximize2, Minimize2, Expand, X
} from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import { api } from '../lib/api';
import { ProgramConfig, Category, Operation, Workflow, Entity, CustomerContext } from '../types';
import { VaultSelect, VaultSelectNative } from '../components/VaultSelect';
import { VaultInput, VaultTextarea } from '../components/VaultInput';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { CapabilitiesSelector } from '../components/program/CapabilitiesSelector';
import { CapabilityManager, CustomCapability } from '../components/program/CapabilityManager';
import { WorkflowManager } from '../components/program/WorkflowManager';
import * as yaml from 'js-yaml';

type TabType = 'general' | 'capabilities' | 'workflows' | 'operations' | 'compliance' | 'integration' | 'yaml';

export const ProgramEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
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
  const [customCapabilities, setCustomCapabilities] = useState<CustomCapability[]>([]);
  const [editorSize, setEditorSize] = useState<'normal' | 'large' | 'fullscreen'>('normal');

  useEffect(() => {
    fetchContextsAndTemplates();
    if (id && id !== 'new') {
      loadProgram();
    } else {
      updateYamlContent();
    }
  }, [id]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editorSize === 'fullscreen') {
        setEditorSize('normal');
      }
    };

    if (editorSize === 'fullscreen') {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [editorSize]);

  // Update YAML whenever program state changes
  useEffect(() => {
    updateYamlContent();
  }, [program, customCapabilities]);

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
      const yamlObj: any = {
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
      
      // Add custom capabilities metadata if any exist
      if (customCapabilities.length > 0) {
        yamlObj.custom_capabilities = customCapabilities.map(cap => ({
          id: cap.id,
          name: cap.name,
          description: cap.description,
          category: cap.category,
          requiredWorkflows: cap.requiredWorkflows,
          suggestedWorkflows: cap.suggestedWorkflows,
          requiredEntities: cap.requiredEntities,
          dependencies: cap.dependencies
        }));
      }
      
      setYamlContent(yaml.dump(yamlObj, { indent: 2, noRefs: true }));
    } catch (err) {
      console.error('Failed to convert to YAML:', err);
    }
  };

  const handleYamlChange = (value: string | undefined) => {
    setYamlContent(value || '');
    try {
      const parsed = yaml.load(value || '') as any;
      
      // Extract custom capabilities if present
      if (parsed.custom_capabilities) {
        setCustomCapabilities(parsed.custom_capabilities.map((cap: any) => ({
          ...cap,
          isCustom: true
        })));
        // Remove from main program object to avoid conflicts
        delete parsed.custom_capabilities;
      }
      
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
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ color: theme.colors.primary, fontSize: theme.typography.fontSize['3xl'], fontWeight: theme.typography.fontWeight.bold }}>
            {id === 'new' ? 'Create Program' : 'Edit Program'}
          </h1>
          <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.sm }}>
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
          <Button
            onClick={() => navigate('/programs')}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            loading={saving}
            variant="primary"
            icon={<Save size={20} />}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ 
          marginBottom: theme.spacing.lg, 
          padding: theme.spacing.md, 
          backgroundColor: `${theme.colors.danger}20`, 
          borderColor: theme.colors.danger, 
          borderWidth: theme.borders.width.thin,
          borderStyle: 'solid',
          borderRadius: theme.borders.radius.lg, 
          color: theme.colors.danger,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ 
          marginBottom: theme.spacing.lg, 
          padding: theme.spacing.md, 
          backgroundColor: `${theme.colors.success}20`, 
          borderColor: theme.colors.success, 
          borderWidth: theme.borders.width.thin,
          borderStyle: 'solid',
          borderRadius: theme.borders.radius.lg, 
          color: theme.colors.success,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm
        }}>
          <Check size={20} />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: theme.spacing.xs, 
        marginBottom: theme.spacing.lg, 
        backgroundColor: theme.colors.surface, 
        padding: theme.spacing.xs, 
        borderRadius: theme.borders.radius.lg,
        width: 'fit-content'
      }}>
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
          onClick={() => setActiveTab('capabilities')}
          className={`px-4 py-2 rounded transition-colors flex items-center space-x-2 ${
            activeTab === 'capabilities'
              ? 'bg-vault-green/20 text-vault-green'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Package size={16} />
          <span>Capabilities</span>
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
      <Card variant="default" padding="lg">
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Program Type Selection */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Program Class
                </label>
                <VaultSelect
                  value={program.program_class || 'template'}
                  onChange={(value) => setProgram(prev => ({ 
                    ...prev, 
                    program_class: value as 'template' | 'subscriber' 
                  }))}
                  options={[
                    { value: 'template', label: 'Template (Reusable)' },
                    { value: 'subscriber', label: 'Subscriber (Customer-specific)' }
                  ]}
                  placeholder="Select Program Class"
                />
              </div>

              {program.program_class === 'subscriber' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Customer Context
                  </label>
                  <VaultSelect
                    value={program.customer_id || ''}
                    onChange={(value) => setProgram(prev => ({ ...prev, customer_id: value }))}
                    options={[
                      { value: '', label: 'Select Customer' },
                      ...contexts.map(ctx => ({
                        value: ctx._id || '',
                        label: ctx.customer?.name || ctx.name || 'Unnamed'
                      }))
                    ]}
                    placeholder="Select Customer"
                  />
                </div>
              )}
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Program Type
                </label>
                <VaultInput
                  type="text"
                  value={program.program_type}
                  onChange={(e) => setProgram(prev => ({ ...prev, program_type: e.target.value }))}
                  placeholder="e.g., ap_automation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Vendor
                </label>
                <VaultInput
                  type="text"
                  value={program.vendor}
                  onChange={(e) => setProgram(prev => ({ ...prev, vendor: e.target.value }))}
                  placeholder="e.g., Highnote Inc."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Version
                </label>
                <VaultInput
                  type="text"
                  value={program.version}
                  onChange={(e) => setProgram(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  API Type
                </label>
                <VaultSelect
                  value={program.api_type}
                  onChange={(value) => setProgram(prev => ({ ...prev, api_type: value as any }))}
                  options={[
                    { value: 'graphql', label: 'GraphQL' },
                    { value: 'rest', label: 'REST' },
                    { value: 'soap', label: 'SOAP' }
                  ]}
                  placeholder="Select API Type"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <VaultSelect
                  value={program.status || 'draft'}
                  onChange={(value) => setProgram(prev => ({ ...prev, status: value as any }))}
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'active', label: 'Active' },
                    { value: 'archived', label: 'Archived' }
                  ]}
                  placeholder="Select Status"
                />
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-vault-green">Metadata</h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Name
                </label>
                <VaultInput
                  type="text"
                  value={program.metadata?.name || ''}
                  onChange={(e) => setProgram(prev => ({ 
                    ...prev, 
                    metadata: { ...prev.metadata, name: e.target.value } 
                  }))}
                  placeholder="Program display name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <VaultTextarea
                  value={program.metadata?.description || ''}
                  onChange={(e) => setProgram(prev => ({ 
                    ...prev, 
                    metadata: { ...prev.metadata, description: e.target.value } 
                  }))}
                  placeholder="Program description"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Base URL
                </label>
                <VaultInput
                  type="text"
                  value={program.metadata?.base_url || ''}
                  onChange={(e) => setProgram(prev => ({ 
                    ...prev, 
                    metadata: { ...prev.metadata, base_url: e.target.value } 
                  }))}
                  placeholder="https://api.example.com/graphql"
                />
              </div>
            </div>

          </div>
        )}

        {activeTab === 'capabilities' && (
          <div className="space-y-6">
            {/* Capabilities Selector */}
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text }}>
                Select Capabilities
              </h3>
              <CapabilitiesSelector
                selectedCapabilities={program.capabilities || []}
                onChange={(capabilities) => {
                  setProgram(prev => ({ ...prev, capabilities }));
                }}
                onWorkflowsGenerated={(workflows) => {
                  // Optionally merge generated workflows with existing ones
                  console.log('Generated workflows:', workflows);
                }}
                customCapabilities={customCapabilities}
              />
            </div>

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${theme.colors.border}`, margin: '2rem 0' }} />

            {/* Custom Capabilities Manager */}
            <div>
              <CapabilityManager
                capabilities={customCapabilities}
                onAdd={(capability) => {
                  setCustomCapabilities(prev => [...prev, capability]);
                  // Optionally auto-select the new capability
                  setProgram(prev => ({
                    ...prev,
                    capabilities: [...(prev.capabilities || []), capability.id]
                  }));
                }}
                onEdit={(id, capability) => {
                  setCustomCapabilities(prev => 
                    prev.map(cap => cap.id === id ? capability : cap)
                  );
                  // Update the capability ID in selected capabilities if it changed
                  if (id !== capability.id && program.capabilities?.includes(id)) {
                    setProgram(prev => ({
                      ...prev,
                      capabilities: prev.capabilities?.map(capId => 
                        capId === id ? capability.id : capId
                      )
                    }));
                  }
                }}
                onRemove={(id) => {
                  setCustomCapabilities(prev => prev.filter(cap => cap.id !== id));
                  // Remove from selected capabilities
                  setProgram(prev => ({
                    ...prev,
                    capabilities: prev.capabilities?.filter(capId => capId !== id)
                  }));
                }}
                existingCapabilityIds={[
                  ...(program.capabilities || []),
                  ...customCapabilities.map(c => c.id)
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === 'workflows' && (
          <div>
            <WorkflowManager
              workflows={program.workflows || {}}
              onChange={(workflows) => {
                setProgram(prev => ({ ...prev, workflows }));
              }}
              operations={
                // Get all operations from categories if available
                program.categories?.flatMap(cat => 
                  cat.operations?.map(op => op.name) || []
                ) || []
              }
            />
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
          <div className={editorSize === 'fullscreen' ? 'fixed inset-0 z-50 bg-gray-900 p-6' : ''}>
            <div className="mb-4 flex justify-between items-center">
              <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                Edit the raw YAML configuration. Changes will be reflected in the form view.
              </div>
              <div className="flex items-center gap-2">
                {/* Size Toggle Buttons */}
                <div className="flex items-center gap-1 p-1 rounded" style={{
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`
                }}>
                  <button
                    onClick={() => setEditorSize('normal')}
                    className="px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
                    style={{
                      backgroundColor: editorSize === 'normal' ? theme.colors.primaryBackground : 'transparent',
                      color: editorSize === 'normal' ? theme.colors.primary : theme.colors.textMuted
                    }}
                    title="Normal size (800px)"
                  >
                    <Minimize2 size={12} />
                    <span>Normal</span>
                  </button>
                  <button
                    onClick={() => setEditorSize('large')}
                    className="px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
                    style={{
                      backgroundColor: editorSize === 'large' ? theme.colors.primaryBackground : 'transparent',
                      color: editorSize === 'large' ? theme.colors.primary : theme.colors.textMuted
                    }}
                    title="Large size (1200px)"
                  >
                    <Expand size={12} />
                    <span>Large</span>
                  </button>
                  <button
                    onClick={() => setEditorSize('fullscreen')}
                    className="px-2 py-1 rounded text-xs transition-colors flex items-center gap-1"
                    style={{
                      backgroundColor: editorSize === 'fullscreen' ? theme.colors.primaryBackground : 'transparent',
                      color: editorSize === 'fullscreen' ? theme.colors.primary : theme.colors.textMuted
                    }}
                    title="Fullscreen"
                  >
                    <Maximize2 size={12} />
                    <span>Full</span>
                  </button>
                </div>

                {/* Export/Import Buttons */}
                <div className="flex gap-2">
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
                    className="flex items-center gap-1 px-3 py-1 rounded transition-colors text-sm"
                    style={{
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.textMuted,
                      border: `1px solid ${theme.colors.border}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.primary;
                      e.currentTarget.style.borderColor = theme.colors.primaryBorder;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textMuted;
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  >
                    <Download size={14} />
                    <span>Export</span>
                  </button>
                  <label 
                    className="flex items-center gap-1 px-3 py-1 rounded transition-colors text-sm cursor-pointer"
                    style={{
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.textMuted,
                      border: `1px solid ${theme.colors.border}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.primary;
                      e.currentTarget.style.borderColor = theme.colors.primaryBorder;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textMuted;
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  >
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

                {/* Close button for fullscreen */}
                {editorSize === 'fullscreen' && (
                  <button
                    onClick={() => setEditorSize('normal')}
                    className="ml-2 p-2 rounded transition-colors"
                    style={{
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.textMuted,
                      border: `1px solid ${theme.colors.border}`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.danger;
                      e.currentTarget.style.borderColor = theme.colors.danger;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textMuted;
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                    title="Exit fullscreen"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
            
            {/* Monaco Editor with dynamic height */}
            <div style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borders.radius.md,
              overflow: 'hidden',
              transition: 'all 0.3s ease-in-out'
            }}>
              <Editor
                height={
                  editorSize === 'fullscreen' 
                    ? 'calc(100vh - 120px)' 
                    : editorSize === 'large' 
                      ? '1200px' 
                      : '800px'
                }
                defaultLanguage="yaml"
                value={yamlContent}
                onChange={handleYamlChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: editorSize === 'fullscreen' },
                  fontSize: editorSize === 'fullscreen' ? 16 : 14,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible',
                    useShadows: false,
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10
                  }
                }}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};