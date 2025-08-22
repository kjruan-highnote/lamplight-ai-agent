import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Save, FileCode, AlertCircle, Check, Plus, 
  Package, Users, Upload, Download, Settings, Shield, 
  Zap, Globe, Maximize2, Minimize2, Expand, X,
  Database, GitBranch, Clock, Tag,
  Code, Layers, Link, BarChart3
} from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import { api } from '../lib/api';
import { ProgramConfig, Operation, CustomerContext } from '../types';
import { VaultSelect } from '../components/VaultSelect';
import { VaultInput, VaultTextarea } from '../components/VaultInput';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { CapabilitiesSelector } from '../components/program/CapabilitiesSelector';
import { CapabilityManager, CustomCapability } from '../components/program/CapabilityManager';
import { WorkflowManager } from '../components/program/WorkflowManager';
import * as yaml from 'js-yaml';
import { sampleWorkflows } from '../data/sampleWorkflows';

type TabType = 'general' | 'capabilities' | 'workflows' | 'operations' | 'compliance' | 'integration' | 'yaml';

export const ProgramEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [program, setProgram] = useState<ProgramConfig>({
    program_type: '',
    vendor: 'Highnote Inc.',
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
    workflows: sampleWorkflows, // Initialize with sample workflows for testing
    entities: [],
    categories: [],
    tags: [],
    status: 'draft',
    // Initialize with common payment card issuer compliance standards
    compliance: {
      standards: [
        { name: 'PCI_DSS', level: 1, required: true },
        { name: 'VISA_MERCHANT_AGREEMENT', required: true },
        { name: 'MASTERCARD_RULES', required: true },
        { name: 'AMEX_MERCHANT_AGREEMENT', required: false },
        { name: 'DISCOVER_NETWORK_COMPLIANCE', required: false }
      ],
      regulations: [
        { name: 'CARD_BRAND_RULES', description: 'Compliance with all applicable card brand rules and regulations' },
        { name: 'CHARGEBACK_MANAGEMENT', description: 'Procedures for handling chargebacks and disputes' },
        { name: 'FRAUD_MONITORING', description: 'Real-time fraud detection and prevention measures' }
      ],
      security: {
        encryption: {
          in_transit: 'TLS 1.2+',
          at_rest: 'AES-256'
        },
        authentication: [
          { type: 'api_key', rotation_days: 90 },
          { type: 'bearer_token' }
        ],
        data_retention: {
          'transaction_data': '7 years',
          'card_data': 'tokenized',
          'audit_logs': '2 years'
        }
      }
    }
  });
  
  const [yamlContent, setYamlContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contexts, setContexts] = useState<CustomerContext[]>([]);
  const [customCapabilities, setCustomCapabilities] = useState<CustomCapability[]>([]);
  const [editorSize, setEditorSize] = useState<'normal' | 'large' | 'fullscreen'>('normal');
  const [availableOperations, setAvailableOperations] = useState<string[]>([]);
  const [fullOperationsData, setFullOperationsData] = useState<Operation[]>([]);
  
  // Modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [operationModalOpen, setOperationModalOpen] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number>(-1);
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const [regulationModalOpen, setRegulationModalOpen] = useState(false);
  
  // Form states for modals
  const [newCategory, setNewCategory] = useState({
    name: '',
    display_name: '',
    description: ''
  });
  
  const [newOperation, setNewOperation] = useState({
    name: '',
    type: 'query' as 'query' | 'mutation' | 'subscription',
    required: false
  });
  const [operationSearch, setOperationSearch] = useState('');
  const [operationsLoading, setOperationsLoading] = useState(false);
  
  // Compliance form states
  const [newComplianceStandard, setNewComplianceStandard] = useState({
    name: '',
    level: undefined as number | undefined,
    required: false
  });
  
  const [newRegulation, setNewRegulation] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchContextsAndOperations();
    if (id && id !== 'new') {
      loadProgram();
    } else {
      updateYamlContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, customCapabilities]);

  const fetchContextsAndOperations = async () => {
    try {
      setOperationsLoading(true);
      const [contextsData, operationsData] = await Promise.all([
        api.contexts.list(),
        api.operations.list({ pageSize: 1000 }) // Get a large number of operations
      ]);
      setContexts(contextsData);
      
      // Extract operation names for the workflow manager
      // Handle both paginated and non-paginated responses
      let operations: Operation[] = [];
      
      if (operationsData) {
        if ('data' in operationsData && Array.isArray(operationsData.data)) {
          // Paginated response
          operations = operationsData.data as Operation[];
        } else if (Array.isArray(operationsData)) {
          // Direct array response
          operations = operationsData;
        }
        
        setFullOperationsData(operations);
        setAvailableOperations(operations.map(op => op.name));
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setFullOperationsData([]);
      setAvailableOperations([]);
    } finally {
      setOperationsLoading(false);
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
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const result = await api.programs.create(program);
        setSuccess('Program created successfully');
        setTimeout(() => setSuccess(''), 3000);
        setTimeout(() => navigate(`/programs/${result._id}`), 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  const openAddCategoryModal = () => {
    setNewCategory({
      name: '',
      display_name: '',
      description: ''
    });
    setCategoryModalOpen(true);
  };

  const handleAddCategory = () => {
    if (newCategory.name) {
      setProgram(prev => ({
        ...prev,
        categories: [
          ...(prev.categories || []),
          {
            name: newCategory.name,
            display_name: newCategory.display_name || newCategory.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: newCategory.description || '',
            order: (prev.categories?.length || 0) + 1,
            operations: []
          }
        ]
      }));
      setCategoryModalOpen(false);
    }
  };

  const openAddOperationModal = (categoryIndex: number) => {
    setSelectedCategoryIndex(categoryIndex);
    setNewOperation({
      name: '',
      type: 'query',
      required: false
    });
    setOperationSearch('');
    setOperationModalOpen(true);
  };

  const handleAddOperation = () => {
    if (newOperation.name && selectedCategoryIndex >= 0) {
      // Check if this is an existing operation from the database
      const existingOp = fullOperationsData.find(op => op.name === newOperation.name);
      
      setProgram(prev => {
        const newCategories = [...(prev.categories || [])];
        newCategories[selectedCategoryIndex].operations.push({
          name: newOperation.name,
          type: existingOp?.type || newOperation.type,
          category: newCategories[selectedCategoryIndex].name,
          query: existingOp?.query || '',
          required: newOperation.required,
          description: existingOp?.description || ''
        } as Operation);
        return { ...prev, categories: newCategories };
      });
      setOperationModalOpen(false);
    }
  };

  // Compliance handlers
  const handleAddComplianceStandard = () => {
    if (newComplianceStandard.name) {
      setProgram(prev => ({
        ...prev,
        compliance: {
          standards: [
            ...(prev.compliance?.standards || []),
            {
              name: newComplianceStandard.name,
              level: newComplianceStandard.level,
              required: newComplianceStandard.required
            }
          ],
          regulations: prev.compliance?.regulations || [],
          security: prev.compliance?.security || {
            encryption: { in_transit: '', at_rest: '' },
            authentication: [],
            data_retention: {}
          }
        }
      }));
      setComplianceModalOpen(false);
      setNewComplianceStandard({ name: '', level: undefined, required: false });
    }
  };

  const removeComplianceStandard = (index: number) => {
    setProgram(prev => ({
      ...prev,
      compliance: prev.compliance ? {
        ...prev.compliance,
        standards: prev.compliance.standards.filter((_, i) => i !== index)
      } : undefined
    }));
  };

  const handleAddRegulation = () => {
    if (newRegulation.name) {
      setProgram(prev => ({
        ...prev,
        compliance: {
          standards: prev.compliance?.standards || [],
          regulations: [
            ...(prev.compliance?.regulations || []),
            {
              name: newRegulation.name,
              description: newRegulation.description
            }
          ],
          security: prev.compliance?.security || {
            encryption: { in_transit: '', at_rest: '' },
            authentication: [],
            data_retention: {}
          }
        }
      }));
      setRegulationModalOpen(false);
      setNewRegulation({ name: '', description: '' });
    }
  };

  const removeRegulation = (index: number) => {
    setProgram(prev => ({
      ...prev,
      compliance: prev.compliance ? {
        ...prev.compliance,
        regulations: prev.compliance.regulations.filter((_, i) => i !== index)
      } : undefined
    }));
  };

  const updateSecuritySetting = (category: string, field: string, value: string) => {
    setProgram(prev => ({
      ...prev,
      compliance: {
        standards: prev.compliance?.standards || [],
        regulations: prev.compliance?.regulations || [],
        security: {
          ...prev.compliance?.security || {
            encryption: { in_transit: '', at_rest: '' },
            authentication: [],
            data_retention: {}
          },
          [category]: {
            ...(prev.compliance?.security as any)?.[category] || {},
            [field]: value
          }
        }
      }
    }));
  };

  const addAuthenticationMethod = () => {
    setProgram(prev => ({
      ...prev,
      compliance: {
        standards: prev.compliance?.standards || [],
        regulations: prev.compliance?.regulations || [],
        security: {
          encryption: prev.compliance?.security?.encryption || { in_transit: '', at_rest: '' },
          authentication: [
            ...(prev.compliance?.security?.authentication || []),
            { type: '', rotation_days: undefined }
          ],
          data_retention: prev.compliance?.security?.data_retention || {}
        }
      }
    }));
  };

  const updateAuthenticationMethod = (index: number, field: string, value: any) => {
    setProgram(prev => {
      const auth = [...(prev.compliance?.security?.authentication || [])];
      auth[index] = { ...auth[index], [field]: value };
      return {
        ...prev,
        compliance: {
          standards: prev.compliance?.standards || [],
          regulations: prev.compliance?.regulations || [],
          security: {
            encryption: prev.compliance?.security?.encryption || { in_transit: '', at_rest: '' },
            authentication: auth,
            data_retention: prev.compliance?.security?.data_retention || {}
          }
        }
      };
    });
  };

  const removeAuthenticationMethod = (index: number) => {
    setProgram(prev => ({
      ...prev,
      compliance: prev.compliance ? {
        ...prev.compliance,
        security: prev.compliance.security ? {
          ...prev.compliance.security,
          authentication: prev.compliance.security.authentication.filter((_, i) => i !== index)
        } : {
          encryption: { in_transit: '', at_rest: '' },
          authentication: [],
          data_retention: {}
        }
      } : undefined
    }));
  };

  const addDataRetentionPolicy = () => {
    setProgram(prev => ({
      ...prev,
      compliance: {
        standards: prev.compliance?.standards || [],
        regulations: prev.compliance?.regulations || [],
        security: {
          encryption: prev.compliance?.security?.encryption || { in_transit: '', at_rest: '' },
          authentication: prev.compliance?.security?.authentication || [],
          data_retention: {
            ...prev.compliance?.security?.data_retention || {},
            '': ''
          }
        }
      }
    }));
  };

  const updateDataRetentionKey = (oldKey: string, newKey: string) => {
    setProgram(prev => {
      const retention = { ...prev.compliance?.security?.data_retention || {} };
      if (oldKey !== newKey) {
        retention[newKey] = retention[oldKey];
        delete retention[oldKey];
      }
      return {
        ...prev,
        compliance: {
          standards: prev.compliance?.standards || [],
          regulations: prev.compliance?.regulations || [],
          security: {
            encryption: prev.compliance?.security?.encryption || { in_transit: '', at_rest: '' },
            authentication: prev.compliance?.security?.authentication || [],
            data_retention: retention
          }
        }
      };
    });
  };

  const updateDataRetentionValue = (key: string, value: string) => {
    setProgram(prev => ({
      ...prev,
      compliance: {
        standards: prev.compliance?.standards || [],
        regulations: prev.compliance?.regulations || [],
        security: {
          encryption: prev.compliance?.security?.encryption || { in_transit: '', at_rest: '' },
          authentication: prev.compliance?.security?.authentication || [],
          data_retention: {
            ...prev.compliance?.security?.data_retention || {},
            [key]: value
          }
        }
      }
    }));
  };

  const removeDataRetentionPolicy = (key: string) => {
    setProgram(prev => {
      const retention = { ...prev.compliance?.security?.data_retention || {} };
      delete retention[key];
      return {
        ...prev,
        compliance: {
          standards: prev.compliance?.standards || [],
          regulations: prev.compliance?.regulations || [],
          security: {
            encryption: prev.compliance?.security?.encryption || { in_transit: '', at_rest: '' },
            authentication: prev.compliance?.security?.authentication || [],
            data_retention: retention
          }
        }
      };
    });
  };

  // Calculate statistics for the program
  const programStats = {
    totalWorkflows: Object.keys(program.workflows || {}).length,
    requiredWorkflows: Object.values(program.workflows || {}).filter(w => w.required).length,
    totalSteps: Object.values(program.workflows || {}).reduce((acc, w) => acc + (w.steps?.length || 0), 0),
    totalOperations: program.categories?.reduce((acc, cat) => acc + (cat.operations?.length || 0), 0) || 0,
    totalCapabilities: (program.capabilities?.length || 0) + customCapabilities.length,
    totalEntities: program.entities?.length || 0,
    complianceStandards: program.compliance?.standards?.length || 0,
    integrations: program.integrations ? 1 : 0,
  };


  return (
    <div className="max-w-7xl mx-auto">
      {/* Enhanced Header with Program Details */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 style={{ color: theme.colors.primary, fontSize: theme.typography.fontSize['3xl'], fontWeight: theme.typography.fontWeight.bold }}>
                {id === 'new' ? 'Create Program' : program.metadata?.name || 'Untitled Program'}
              </h1>
            </div>
            
            {/* Program Metadata */}
            <div className="flex items-center gap-4 text-sm" style={{ color: theme.colors.textMuted }}>
              {program.program_class === 'template' ? (
                <span className="flex items-center gap-1">
                  <Package size={14} />
                  <span>Template</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  <span>Subscriber</span>
                </span>
              )}
              {program.program_type && (
                <span className="flex items-center gap-1">
                  <Tag size={14} />
                  <span>{program.program_type}</span>
                </span>
              )}
              {program.vendor && (
                <span className="flex items-center gap-1">
                  <Database size={14} />
                  <span>{program.vendor}</span>
                </span>
              )}
              {program.version && (
                <span className="flex items-center gap-1">
                  <Code size={14} />
                  <span>v{program.version}</span>
                </span>
              )}
              {program.api_type && (
                <span className="flex items-center gap-1">
                  <Link size={14} />
                  <span className="uppercase">{program.api_type}</span>
                </span>
              )}
              {program.updatedAt && (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>Updated {new Date(program.updatedAt).toLocaleDateString()}</span>
                </span>
              )}
            </div>

            {/* Program Description */}
            {program.metadata?.description && (
              <p className="mt-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                {program.metadata.description}
              </p>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3">
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Workflows */}
          <Card variant="bordered" padding="sm">
            <div className="flex items-center gap-2">
              <GitBranch size={16} style={{ color: theme.colors.primary }} />
              <div>
                <div className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                  {programStats.totalWorkflows}
                </div>
                <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                  Workflows
                </div>
                {programStats.requiredWorkflows > 0 && (
                  <div className="text-xs" style={{ color: theme.colors.warning }}>
                    {programStats.requiredWorkflows} required
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Steps */}
          <Card variant="bordered" padding="sm">
            <div className="flex items-center gap-2">
              <Layers size={16} style={{ color: theme.colors.info }} />
              <div>
                <div className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                  {programStats.totalSteps}
                </div>
                <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                  Total Steps
                </div>
              </div>
            </div>
          </Card>

          {/* Operations */}
          <Card variant="bordered" padding="sm">
            <div className="flex items-center gap-2">
              <Globe size={16} style={{ color: theme.colors.secondary }} />
              <div>
                <div className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                  {programStats.totalOperations}
                </div>
                <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                  Operations
                </div>
              </div>
            </div>
          </Card>

          {/* Capabilities */}
          <Card variant="bordered" padding="sm">
            <div className="flex items-center gap-2">
              <Zap size={16} style={{ color: theme.colors.warning }} />
              <div>
                <div className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                  {programStats.totalCapabilities}
                </div>
                <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                  Capabilities
                </div>
              </div>
            </div>
          </Card>

          {/* Entities */}
          <Card variant="bordered" padding="sm">
            <div className="flex items-center gap-2">
              <Database size={16} style={{ color: theme.colors.success }} />
              <div>
                <div className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                  {programStats.totalEntities}
                </div>
                <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                  Entities
                </div>
              </div>
            </div>
          </Card>

          {/* Compliance */}
          <Card variant="bordered" padding="sm">
            <div className="flex items-center gap-2">
              <Shield size={16} style={{ color: theme.colors.danger }} />
              <div>
                <div className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                  {programStats.complianceStandards}
                </div>
                <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                  Standards
                </div>
              </div>
            </div>
          </Card>

          {/* Integrations */}
          <Card variant="bordered" padding="sm">
            <div className="flex items-center gap-2">
              <Link size={16} style={{ color: theme.colors.primaryBorder }} />
              <div>
                <div className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                  {programStats.integrations}
                </div>
                <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                  Integrations
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Info Bar */}
        {(program.customer_id || program.parent_template_id || (program.tags && program.tags.length > 0)) && (
          <div className="mt-3 p-3 rounded-lg flex items-center gap-6" style={{
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`
          }}>
            {program.customer_id && (
              <div className="flex items-center gap-2">
                <Users size={14} style={{ color: theme.colors.textMuted }} />
                <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Customer: <span style={{ color: theme.colors.text }}>{program.customer_id}</span>
                </span>
              </div>
            )}
            {program.parent_template_id && (
              <div className="flex items-center gap-2">
                <Package size={14} style={{ color: theme.colors.textMuted }} />
                <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Template: <span style={{ color: theme.colors.text }}>{program.parent_template_id}</span>
                </span>
              </div>
            )}
            {program.tags && program.tags.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag size={14} style={{ color: theme.colors.textMuted }} />
                <div className="flex gap-1">
                  {program.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-xs rounded" style={{
                      backgroundColor: theme.colors.primaryBackground,
                      color: theme.colors.primary
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
              {/* Vendor field hidden - defaulting to Highnote Inc. */}
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
                  // Removed console.log to prevent memory leak
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
                // Use operations from database if available, fallback to program categories
                availableOperations.length > 0 
                  ? availableOperations
                  : program.categories?.flatMap(cat => 
                      cat.operations?.map(op => op.name) || []
                    ) || []
              }
              programOperations={
                // Operations that are part of this program
                program.categories?.flatMap(cat => 
                  cat.operations?.map(op => op.name) || []
                ) || []
              }
              onAddToProgramOperations={(operationName) => {
                // Add the operation to the program
                const updatedCategories = [...(program.categories || [])];
                
                // Find or create a default category for workflow operations
                let workflowCategory = updatedCategories.find(cat => cat.name === 'workflow_operations');
                
                if (!workflowCategory) {
                  // Create a new category for workflow operations
                  workflowCategory = {
                    name: 'workflow_operations',
                    display_name: 'Workflow Operations',
                    description: 'Operations used in workflows',
                    order: updatedCategories.length,
                    operations: []
                  };
                  updatedCategories.push(workflowCategory);
                }
                
                // Add the operation if it doesn't exist
                const existsInCategory = workflowCategory.operations.some(op => op.name === operationName);
                if (!existsInCategory) {
                  workflowCategory.operations.push({
                    name: operationName,
                    type: 'query', // Default to query, user can change later
                    required: false,
                    category: 'workflow_operations',
                    query: `# TODO: Define the GraphQL query for ${operationName}`
                  });
                }
                
                setProgram(prev => ({ ...prev, categories: updatedCategories }));
                
                // Show success message
                setSuccess(`Added operation "${operationName}" to program operations`);
                setTimeout(() => setSuccess(''), 3000);
              }}
            />
          </div>
        )}

        {activeTab === 'operations' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-vault-green">Operation Categories</h3>
              <button
                onClick={openAddCategoryModal}
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
                    onClick={() => openAddOperationModal(catIdx)}
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
                        {op.type ? op.type.toUpperCase() : 'UNKNOWN'}
                      </span>
                      <span className="font-mono text-sm text-gray-300 bg-gray-800 px-3 py-1 rounded border border-gray-700">
                        {op.name}
                      </span>
                      <label className="flex items-center space-x-1 ml-auto">
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
            {/* Compliance Standards */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold" style={{ color: theme.colors.primary }}>
                  Compliance Standards
                </h3>
                <Button
                  onClick={() => setComplianceModalOpen(true)}
                  variant="primary"
                  size="sm"
                  icon={<Plus size={16} />}
                >
                  Add Standard
                </Button>
              </div>
              
              {program.compliance?.standards && program.compliance.standards.length > 0 ? (
                <div className="space-y-2">
                  {program.compliance.standards.map((standard, idx) => (
                    <Card key={idx} variant="bordered" padding="sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Shield size={20} style={{ color: standard.required ? theme.colors.danger : theme.colors.warning }} />
                          <div>
                            <div className="font-medium" style={{ color: theme.colors.text }}>
                              {standard.name}
                            </div>
                            {standard.level && (
                              <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                                Level {standard.level}
                              </div>
                            )}
                          </div>
                          {standard.required && (
                            <span className="px-2 py-1 text-xs rounded" style={{
                              backgroundColor: `${theme.colors.danger}20`,
                              color: theme.colors.danger
                            }}>
                              Required
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeComplianceStandard(idx)}
                          className="p-1 rounded hover:bg-gray-800 transition-colors"
                          style={{ color: theme.colors.textMuted }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card variant="bordered" padding="lg">
                  <div className="text-center" style={{ color: theme.colors.textMuted }}>
                    <Shield size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No compliance standards defined</p>
                    <p className="text-sm mt-1">Click "Add Standard" to configure compliance requirements</p>
                  </div>
                </Card>
              )}
            </div>

            {/* Regulations */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold" style={{ color: theme.colors.primary }}>
                  Regulatory Requirements
                </h3>
                <Button
                  onClick={() => setRegulationModalOpen(true)}
                  variant="primary"
                  size="sm"
                  icon={<Plus size={16} />}
                >
                  Add Regulation
                </Button>
              </div>
              
              {program.compliance?.regulations && program.compliance.regulations.length > 0 ? (
                <div className="space-y-2">
                  {program.compliance.regulations.map((regulation, idx) => (
                    <Card key={idx} variant="bordered" padding="sm">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium" style={{ color: theme.colors.text }}>
                            {regulation.name}
                          </div>
                          {regulation.description && (
                            <div className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                              {regulation.description}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeRegulation(idx)}
                          className="p-1 rounded hover:bg-gray-800 transition-colors ml-4"
                          style={{ color: theme.colors.textMuted }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card variant="bordered" padding="lg">
                  <div className="text-center" style={{ color: theme.colors.textMuted }}>
                    <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No regulatory requirements defined</p>
                    <p className="text-sm mt-1">Click "Add Regulation" to configure regulatory compliance</p>
                  </div>
                </Card>
              )}
            </div>

            {/* Security Settings */}
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.primary }}>
                Security Requirements
              </h3>
              
              <div className="space-y-4">
                {/* Encryption */}
                <Card variant="bordered" padding="md">
                  <h4 className="font-medium mb-3" style={{ color: theme.colors.text }}>
                    Encryption Standards
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.textSecondary }}>
                        In Transit
                      </label>
                      <Input
                        value={program.compliance?.security?.encryption?.in_transit || ''}
                        onChange={(e) => updateSecuritySetting('encryption', 'in_transit', e.target.value)}
                        placeholder="e.g., TLS 1.2+"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.textSecondary }}>
                        At Rest
                      </label>
                      <Input
                        value={program.compliance?.security?.encryption?.at_rest || ''}
                        onChange={(e) => updateSecuritySetting('encryption', 'at_rest', e.target.value)}
                        placeholder="e.g., AES-256"
                      />
                    </div>
                  </div>
                </Card>

                {/* Authentication */}
                <Card variant="bordered" padding="md">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium" style={{ color: theme.colors.text }}>
                      Authentication Methods
                    </h4>
                    <Button
                      onClick={() => addAuthenticationMethod()}
                      variant="ghost"
                      size="sm"
                      icon={<Plus size={14} />}
                    >
                      Add Method
                    </Button>
                  </div>
                  {program.compliance?.security?.authentication && program.compliance.security.authentication.length > 0 ? (
                    <div className="space-y-2">
                      {program.compliance.security.authentication.map((auth, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={auth.type}
                            onChange={(e) => updateAuthenticationMethod(idx, 'type', e.target.value)}
                            placeholder="Auth type (e.g., api_key)"
                            className="flex-1"
                          />
                          <Input
                            value={auth.rotation_days || ''}
                            onChange={(e) => updateAuthenticationMethod(idx, 'rotation_days', e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Rotation days"
                            type="number"
                            className="w-32"
                          />
                          <button
                            onClick={() => removeAuthenticationMethod(idx)}
                            className="p-1 rounded hover:bg-gray-800 transition-colors"
                            style={{ color: theme.colors.textMuted }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                      No authentication methods configured
                    </p>
                  )}
                </Card>

                {/* Data Retention */}
                <Card variant="bordered" padding="md">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium" style={{ color: theme.colors.text }}>
                      Data Retention Policies
                    </h4>
                    <Button
                      onClick={() => addDataRetentionPolicy()}
                      variant="ghost"
                      size="sm"
                      icon={<Plus size={14} />}
                    >
                      Add Policy
                    </Button>
                  </div>
                  {program.compliance?.security?.data_retention && Object.keys(program.compliance.security.data_retention).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(program.compliance.security.data_retention).map(([key, value], idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={key}
                            onChange={(e) => updateDataRetentionKey(key, e.target.value)}
                            placeholder="Data type"
                            className="flex-1"
                          />
                          <Input
                            value={value}
                            onChange={(e) => updateDataRetentionValue(key, e.target.value)}
                            placeholder="Retention period"
                            className="flex-1"
                          />
                          <button
                            onClick={() => removeDataRetentionPolicy(key)}
                            className="p-1 rounded hover:bg-gray-800 transition-colors"
                            style={{ color: theme.colors.textMuted }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                      No data retention policies configured
                    </p>
                  )}
                </Card>
              </div>
            </div>
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

      {/* Add Category Modal */}
      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="Add Operation Category"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setCategoryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddCategory}
              disabled={!newCategory.name}
            >
              Add Category
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Category Key <span className="text-red-500">*</span>
            </label>
            <Input
              value={newCategory.name}
              onChange={(e) => {
                const value = e.target.value;
                setNewCategory(prev => ({
                  ...prev,
                  name: value,
                  display_name: prev.display_name || value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                }));
              }}
              placeholder="e.g., card_management, account_operations"
              className="font-mono"
            />
            <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
              Use lowercase with underscores. This will be used as the technical identifier.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Display Name
            </label>
            <Input
              value={newCategory.display_name}
              onChange={(e) => setNewCategory(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="e.g., Card Management, Account Operations"
            />
            <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
              Human-readable name. Will be auto-generated from key if left empty.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Description
            </label>
            <Textarea
              value={newCategory.description}
              onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of what operations in this category do..."
              rows={3}
            />
          </div>
        </div>
      </Modal>

      {/* Add Operation Modal */}
      <Modal
        isOpen={operationModalOpen}
        onClose={() => setOperationModalOpen(false)}
        title="Add Operation"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOperationModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddOperation}
              disabled={!newOperation.name}
            >
              Add Operation
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Quick search for operations */}
          {fullOperationsData.length > 10 && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Search Operations
              </label>
              <Input
                value={operationSearch}
                onChange={(e) => setOperationSearch(e.target.value)}
                placeholder="Type to filter operations..."
                className="mb-2"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Select from Database <span className="text-red-500">*</span>
            </label>
            <Select
              value={newOperation.name}
              onChange={(value) => {
                const existingOp = fullOperationsData.find(op => op.name === value);
                setNewOperation(prev => ({
                  ...prev,
                  name: value,
                  type: existingOp?.type || prev.type
                }));
              }}
              options={[
                { value: '', label: 'Select an existing operation...' },
                ...fullOperationsData
                  .filter(op => 
                    operationSearch === '' || 
                    op.name.toLowerCase().includes(operationSearch.toLowerCase()) ||
                    op.category.toLowerCase().includes(operationSearch.toLowerCase())
                  )
                  .sort((a, b) => {
                    // Sort by category first, then by name
                    if (a.category !== b.category) {
                      return a.category.localeCompare(b.category);
                    }
                    return a.name.localeCompare(b.name);
                  })
                  .map(op => ({ 
                    value: op.name, 
                    label: `${op.name} (${op.type}) - ${op.category}`
                  }))
              ]}
            />
            {operationsLoading ? (
              <p className="text-xs mt-1" style={{ color: theme.colors.info }}>
                Loading operations from database...
              </p>
            ) : fullOperationsData.length > 0 ? (
              <p className="text-xs mt-1" style={{ color: theme.colors.success }}>
                {fullOperationsData.filter(op => 
                  operationSearch === '' || 
                  op.name.toLowerCase().includes(operationSearch.toLowerCase()) ||
                  op.category.toLowerCase().includes(operationSearch.toLowerCase())
                ).length} of {fullOperationsData.length} operations shown
              </p>
            ) : (
              <p className="text-xs mt-1" style={{ color: theme.colors.warning }}>
                No operations found in database. Enter a custom name below.
              </p>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: theme.colors.border }}></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2" style={{ backgroundColor: theme.colors.background, color: theme.colors.textMuted }}>
                OR
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Custom Operation Name
            </label>
            <Input
              value={newOperation.name}
              onChange={(e) => setNewOperation(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., getCardDetails, updateAccountStatus"
              className="font-mono"
            />
            <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
              Can't find what you need? Enter a custom operation name.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Operation Type
            </label>
            <Select
              value={newOperation.type}
              onChange={(value) => setNewOperation(prev => ({ ...prev, type: value as any }))}
              options={[
                { value: 'query', label: 'Query - Read data' },
                { value: 'mutation', label: 'Mutation - Modify data' },
                { value: 'subscription', label: 'Subscription - Real-time updates' }
              ]}
            />
            {fullOperationsData.find(op => op.name === newOperation.name) && (
              <p className="text-xs mt-1" style={{ color: theme.colors.info }}>
                Type will be auto-detected from the existing operation.
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="operation-required"
              checked={newOperation.required}
              onChange={(e) => setNewOperation(prev => ({ ...prev, required: e.target.checked }))}
              className="rounded border-gray-700"
            />
            <label htmlFor="operation-required" className="text-sm" style={{ color: theme.colors.text }}>
              Mark as required operation
            </label>
          </div>

          {/* Show operation details if it exists in database */}
          {fullOperationsData.find(op => op.name === newOperation.name) && (
            <div className="p-3 rounded" style={{ 
              backgroundColor: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`
            }}>
              <div className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>
                Operation Details
              </div>
              {(() => {
                const op = fullOperationsData.find(op => op.name === newOperation.name);
                return op ? (
                  <div className="space-y-1 text-xs" style={{ color: theme.colors.textMuted }}>
                    <div>Type: <span style={{ color: theme.colors.text }}>{op.type}</span></div>
                    <div>Category: <span style={{ color: theme.colors.text }}>{op.category}</span></div>
                    {op.description && (
                      <div>Description: <span style={{ color: theme.colors.text }}>{op.description}</span></div>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </Modal>

      {/* Add Compliance Standard Modal */}
      <Modal
        isOpen={complianceModalOpen}
        onClose={() => setComplianceModalOpen(false)}
        title="Add Compliance Standard"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setComplianceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddComplianceStandard}
              disabled={!newComplianceStandard.name}
            >
              Add Standard
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Standard Name <span className="text-red-500">*</span>
            </label>
            <Select
              value={newComplianceStandard.name}
              onChange={(value) => setNewComplianceStandard(prev => ({ ...prev, name: value }))}
              options={[
                { value: '', label: 'Select a compliance standard...' },
                { value: 'PCI_DSS', label: 'PCI DSS - Payment Card Industry Data Security Standard' },
                { value: 'PCI_3DS', label: 'PCI 3DS - 3D Secure Standard' },
                { value: 'VISA_MERCHANT_AGREEMENT', label: 'Visa Merchant Agreement' },
                { value: 'VISA_ACQUIRER_RISK_PROGRAM', label: 'Visa Acquirer Risk Program (VARP)' },
                { value: 'MASTERCARD_RULES', label: 'Mastercard Rules and Regulations' },
                { value: 'MASTERCARD_SDP', label: 'Mastercard Site Data Protection (SDP)' },
                { value: 'AMEX_MERCHANT_AGREEMENT', label: 'American Express Merchant Agreement' },
                { value: 'AMEX_ESA', label: 'American Express Enhanced Security Agreement' },
                { value: 'DISCOVER_NETWORK_COMPLIANCE', label: 'Discover Network Compliance' },
                { value: 'JCB_COMPLIANCE', label: 'JCB International Compliance' },
                { value: 'UNIONPAY_REQUIREMENTS', label: 'UnionPay Requirements' },
                { value: 'EMV_COMPLIANCE', label: 'EMV Chip Card Standards' },
                { value: 'PA_DSS', label: 'PA-DSS - Payment Application Data Security Standard' },
                { value: 'SOC2_TYPE2', label: 'SOC 2 Type II Certification' },
                { value: 'ISO_27001', label: 'ISO 27001 Information Security' },
                { value: 'GDPR', label: 'GDPR - General Data Protection Regulation' },
                { value: 'CCPA', label: 'CCPA - California Consumer Privacy Act' },
                { value: 'NACHA', label: 'NACHA - ACH Network Rules' },
                { value: 'CUSTOM', label: 'Custom Standard' }
              ]}
            />
            {newComplianceStandard.name === 'CUSTOM' && (
              <Input
                value={newComplianceStandard.name}
                onChange={(e) => setNewComplianceStandard(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter custom standard name"
                className="mt-2"
              />
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Compliance Level
            </label>
            <Select
              value={newComplianceStandard.level?.toString() || ''}
              onChange={(value) => setNewComplianceStandard(prev => ({ 
                ...prev, 
                level: value ? parseInt(value) : undefined 
              }))}
              options={[
                { value: '', label: 'No specific level' },
                { value: '1', label: 'Level 1 - Highest' },
                { value: '2', label: 'Level 2' },
                { value: '3', label: 'Level 3' },
                { value: '4', label: 'Level 4 - Lowest' }
              ]}
            />
            <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
              Applicable for standards like PCI DSS that have compliance levels
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="standard-required"
              checked={newComplianceStandard.required}
              onChange={(e) => setNewComplianceStandard(prev => ({ ...prev, required: e.target.checked }))}
              className="rounded border-gray-700"
            />
            <label htmlFor="standard-required" className="text-sm" style={{ color: theme.colors.text }}>
              Mark as required compliance standard
            </label>
          </div>
        </div>
      </Modal>

      {/* Add Regulation Modal */}
      <Modal
        isOpen={regulationModalOpen}
        onClose={() => setRegulationModalOpen(false)}
        title="Add Regulatory Requirement"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setRegulationModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddRegulation}
              disabled={!newRegulation.name}
            >
              Add Regulation
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Regulation Name <span className="text-red-500">*</span>
            </label>
            <Select
              value={newRegulation.name}
              onChange={(value) => setNewRegulation(prev => ({ ...prev, name: value }))}
              options={[
                { value: '', label: 'Select a regulation...' },
                { value: 'CARD_BRAND_RULES', label: 'Card Brand Rules Compliance' },
                { value: 'CHARGEBACK_MANAGEMENT', label: 'Chargeback Management Requirements' },
                { value: 'FRAUD_MONITORING', label: 'Fraud Monitoring and Prevention' },
                { value: 'KYC_AML', label: 'KYC/AML - Know Your Customer / Anti-Money Laundering' },
                { value: 'USA_PATRIOT_ACT', label: 'USA PATRIOT Act' },
                { value: 'OFAC', label: 'OFAC Sanctions Screening' },
                { value: 'REG_E', label: 'Regulation E - Electronic Fund Transfers' },
                { value: 'REG_Z', label: 'Regulation Z - Truth in Lending' },
                { value: 'FAIR_LENDING', label: 'Fair Lending Practices' },
                { value: 'FCRA', label: 'FCRA - Fair Credit Reporting Act' },
                { value: 'BSA', label: 'BSA - Bank Secrecy Act' },
                { value: 'DISPUTE_RESOLUTION', label: 'Dispute Resolution Procedures' },
                { value: 'DATA_BREACH_NOTIFICATION', label: 'Data Breach Notification Requirements' },
                { value: 'CROSS_BORDER_COMPLIANCE', label: 'Cross-Border Transaction Compliance' },
                { value: 'CUSTOM', label: 'Custom Regulation' }
              ]}
            />
            {newRegulation.name === 'CUSTOM' && (
              <Input
                value={newRegulation.name}
                onChange={(e) => setNewRegulation(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter custom regulation name"
                className="mt-2"
              />
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Description
            </label>
            <Textarea
              value={newRegulation.description}
              onChange={(e) => setNewRegulation(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the regulatory requirement and its implications..."
              rows={4}
            />
            <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
              Provide details about what this regulation requires and how it affects the program
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};