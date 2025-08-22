import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Save, Eye, FileJson, AlertCircle, Check, Plus, Trash2, Users, Target, Shield } from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import { api } from '../lib/api';
import { CustomerContext, Contact, UseCase, KPI, Milestone } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';

const defaultContext: CustomerContext = {
  name: '',
  version: '1.0.0',
  customer: {
    name: '',
    industry: '',
    entity: '',
    type: '',
    contacts: [],
  },
  business_context: {
    current_state: {
      description: '',
      pain_points: [],
    },
    objectives: {
      primary: [],
      secondary: [],
    },
    business_model: {
      description: '',
      key_points: [],
    },
  },
  use_cases: {
    primary: [],
    secondary: [],
  },
  requirements: {
    business: [],
    operational: [],
    financial: [],
  },
  success_metrics: {
    kpis: [],
    milestones: [],
  },
  stakeholders: {
    executive_sponsor: '',
    business_owner: '',
    technical_lead: '',
    end_users: [],
  },
  integration_landscape: {
    internal_systems: [],
    external_partners: [],
  },
  risk_considerations: {
    business_risks: [],
    mitigation_strategies: [],
  },
  tags: [],
};

export const ContextEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [context, setContext] = useState<CustomerContext>(defaultContext);
  const [jsonContent, setJsonContent] = useState('');
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [activeTab, setActiveTab] = useState<'customer' | 'business' | 'usecases' | 'requirements' | 'metrics' | 'integration'>('customer');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (id && id !== 'new') {
      loadContext();
    } else {
      setJsonContent(JSON.stringify(context, null, 2));
    }
  }, [id]);

  const loadContext = async () => {
    try {
      const data = await api.contexts.get(id!);
      setContext(data);
      setJsonContent(JSON.stringify(data, null, 2));
    } catch (err) {
      setError('Failed to load context');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (viewMode === 'json') {
        try {
          const parsedData = JSON.parse(jsonContent);
          setContext(parsedData);
        } catch (e) {
          setError('Invalid JSON format');
          setSaving(false);
          return;
        }
      }

      const saveData = viewMode === 'json' ? JSON.parse(jsonContent) : context;

      if (id && id !== 'new') {
        await api.contexts.update(id, saveData);
        setSuccess('Context updated successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const result = await api.contexts.create(saveData);
        setSuccess('Context created successfully');
        setTimeout(() => setSuccess(''), 3000);
        navigate(`/contexts/${result._id}`, { replace: true });
      }
    } catch (err) {
      setError('Failed to save context');
    } finally {
      setSaving(false);
    }
  };

  const updateContext = (path: string, value: any) => {
    setContext(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current: any = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      setJsonContent(JSON.stringify(updated, null, 2));
      return updated;
    });
  };

  const addContact = () => {
    const newContact: Contact = { name: '', email: '', role: '' };
    updateContext('customer.contacts', [...(context.customer?.contacts || []), newContact]);
  };

  const removeContact = (index: number) => {
    updateContext('customer.contacts', context.customer?.contacts?.filter((_, i) => i !== index) || []);
  };

  const addUseCase = (type: 'primary' | 'secondary') => {
    const newUseCase: UseCase = {
      title: '',
      description: '',
      scenarios: [],
      value_proposition: '',
    };
    updateContext(`use_cases.${type}`, [...(context.use_cases?.[type] || []), newUseCase]);
  };

  const addKPI = () => {
    const newKPI: KPI = { metric: '', target: '', timeline: '' };
    updateContext('success_metrics.kpis', [...(context.success_metrics?.kpis || []), newKPI]);
  };

  const addMilestone = () => {
    const newMilestone: Milestone = {
      phase: '',
      description: '',
      timeline: '',
      success_criteria: '',
    };
    updateContext('success_metrics.milestones', [...(context.success_metrics?.milestones || []), newMilestone]);
  };

  const addArrayItem = (path: string, value: string) => {
    const keys = path.split('.');
    let current: any = context;
    for (const key of keys) {
      current = current?.[key];
    }
    if (value && !current?.includes(value)) {
      updateContext(path, [...(current || []), value]);
    }
  };

  const removeArrayItem = (path: string, index: number) => {
    const keys = path.split('.');
    let current: any = context;
    for (const key of keys) {
      current = current?.[key];
    }
    updateContext(path, current?.filter((_: any, i: number) => i !== index) || []);
  };

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: theme.spacing.lg,
        border: `2px solid ${theme.colors.primaryBorder}`,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontFamily: theme.typography.fontFamily.mono,
              color: theme.colors.primary,
              fontWeight: theme.typography.fontWeight.bold
            }}>
              ▶ {id === 'new' ? 'NEW CONTEXT' : 'EDIT CONTEXT'}
            </h1>
            {context.name && (
              <div style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.textMuted,
                marginTop: theme.spacing.xs
              }}>{context.name}</div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setViewMode(viewMode === 'form' ? 'json' : 'form')}
              variant="secondary"
              size="sm"
              icon={viewMode === 'form' ? <FileJson size={16} /> : <Eye size={16} />}
            >
              {viewMode === 'form' ? 'JSON' : 'FORM'}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              loading={saving}
              variant="primary"
              icon={<Save size={16} />}
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          marginBottom: theme.spacing.md,
          padding: theme.spacing.sm,
          backgroundColor: `${theme.colors.danger}20`,
          border: `${theme.borders.width.thin} solid ${theme.colors.danger}`,
          borderRadius: theme.borders.radius.md,
          color: theme.colors.danger,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm
        }}>
          <AlertCircle size={16} />
          <span style={{ fontSize: theme.typography.fontSize.sm, fontFamily: theme.typography.fontFamily.mono }}>{error}</span>
        </div>
      )}
      {success && (
        <div style={{
          marginBottom: theme.spacing.md,
          padding: theme.spacing.sm,
          backgroundColor: `${theme.colors.success}20`,
          border: `${theme.borders.width.thin} solid ${theme.colors.success}`,
          borderRadius: theme.borders.radius.md,
          color: theme.colors.success,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm
        }}>
          <Check size={16} />
          <span style={{ fontSize: theme.typography.fontSize.sm, fontFamily: theme.typography.fontFamily.mono }}>{success}</span>
        </div>
      )}

      {/* Editor Content */}
      <Card variant="bordered" padding="none">
        {viewMode === 'form' ? (
          <div>
            {/* Tab Navigation */}
            <div style={{
              display: 'flex',
              borderBottom: `${theme.borders.width.thin} solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface
            }}>
              {[
                { id: 'customer', label: 'CUSTOMER', icon: Users },
                { id: 'business', label: 'BUSINESS', icon: Target },
                { id: 'usecases', label: 'USE CASES', icon: FileJson },
                { id: 'requirements', label: 'REQUIREMENTS', icon: Shield },
                { id: 'metrics', label: 'METRICS', icon: Target },
                { id: 'integration', label: 'INTEGRATION', icon: Shield },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-3 font-mono text-xs flex items-center space-x-2 border-r border-vault-green/30 transition-all ${
                      activeTab === tab.id
                        ? 'bg-vault-green/20 text-vault-green'
                        : 'text-vault-green/50 hover:bg-vault-green/10 hover:text-vault-green'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-6 space-y-6">
              {/* Customer Tab */}
              {activeTab === 'customer' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-vault-green/50 mb-2 font-terminal">CONTEXT NAME</label>
                      <input
                        type="text"
                        value={context.name || ''}
                        onChange={(e) => updateContext('name', e.target.value)}
                        placeholder="e.g., triplink_context_v2"
                        className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-vault-green/50 mb-2 font-terminal">VERSION</label>
                      <input
                        type="text"
                        value={context.version || ''}
                        onChange={(e) => updateContext('version', e.target.value)}
                        placeholder="1.0.0"
                        className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-vault-green/50 font-terminal">═══ CUSTOMER INFORMATION ═══</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-vault-green/50 mb-2">COMPANY NAME</label>
                      <input
                        type="text"
                        value={context.customer?.name || ''}
                        onChange={(e) => updateContext('customer.name', e.target.value)}
                        className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-vault-green/50 mb-2">INDUSTRY</label>
                      <input
                        type="text"
                        value={context.customer?.industry || ''}
                        onChange={(e) => updateContext('customer.industry', e.target.value)}
                        className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-vault-green/50 mb-2">ENTITY</label>
                      <input
                        type="text"
                        value={context.customer?.entity || ''}
                        onChange={(e) => updateContext('customer.entity', e.target.value)}
                        className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-vault-green/50 mb-2">TYPE</label>
                      <input
                        type="text"
                        value={context.customer?.type || ''}
                        onChange={(e) => updateContext('customer.type', e.target.value)}
                        placeholder="e.g., B2B Travel Platform"
                        className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                      />
                    </div>
                  </div>

                  {/* Contacts */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-vault-green/50 font-terminal">═══ CONTACTS ═══</div>
                      <button
                        onClick={addContact}
                        className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all flex items-center space-x-1"
                      >
                        <Plus size={14} />
                        <span>ADD CONTACT</span>
                      </button>
                    </div>
                    
                    {context.customer?.contacts?.map((contact, index) => (
                      <div key={index} className="p-4 bg-vault-terminal border border-vault-green/30 space-y-3">
                        <div className="flex justify-between">
                          <span className="text-xs text-vault-green/50">CONTACT #{index + 1}</span>
                          <button
                            onClick={() => removeContact(index)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) => {
                              const updated = [...(context.customer?.contacts || [])];
                              updated[index] = { ...updated[index], name: e.target.value };
                              updateContext('customer.contacts', updated);
                            }}
                            placeholder="Name"
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <input
                            type="email"
                            value={contact.email}
                            onChange={(e) => {
                              const updated = [...(context.customer?.contacts || [])];
                              updated[index] = { ...updated[index], email: e.target.value };
                              updateContext('customer.contacts', updated);
                            }}
                            placeholder="Email"
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <input
                            type="text"
                            value={contact.role}
                            onChange={(e) => {
                              const updated = [...(context.customer?.contacts || [])];
                              updated[index] = { ...updated[index], role: e.target.value };
                              updateContext('customer.contacts', updated);
                            }}
                            placeholder="Role"
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Business Context Tab */}
              {activeTab === 'business' && (
                <div className="space-y-6">
                  <div className="text-xs text-vault-green/50 font-terminal">═══ CURRENT STATE ═══</div>
                  
                  <div>
                    <label className="block text-xs text-vault-green/50 mb-2">DESCRIPTION</label>
                    <textarea
                      value={context.business_context?.current_state?.description || ''}
                      onChange={(e) => updateContext('business_context.current_state.description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-vault-green/50 mb-2">PAIN POINTS</label>
                    <div className="space-y-2">
                      {context.business_context?.current_state?.pain_points?.map((point, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={point}
                            onChange={(e) => {
                              const updated = [...(context.business_context?.current_state?.pain_points || [])];
                              updated[index] = e.target.value;
                              updateContext('business_context.current_state.pain_points', updated);
                            }}
                            className="flex-1 px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <button
                            onClick={() => removeArrayItem('business_context.current_state.pain_points', index)}
                            className="px-3 py-2 text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayItem('business_context.current_state.pain_points', '')}
                        className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                      >
                        + ADD PAIN POINT
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-vault-green/50 font-terminal">═══ OBJECTIVES ═══</div>
                  
                  <div>
                    <label className="block text-xs text-vault-green/50 mb-2">PRIMARY OBJECTIVES</label>
                    <div className="space-y-2">
                      {context.business_context?.objectives?.primary?.map((obj, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={obj}
                            onChange={(e) => {
                              const updated = [...(context.business_context?.objectives?.primary || [])];
                              updated[index] = e.target.value;
                              updateContext('business_context.objectives.primary', updated);
                            }}
                            className="flex-1 px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <button
                            onClick={() => removeArrayItem('business_context.objectives.primary', index)}
                            className="px-3 py-2 text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayItem('business_context.objectives.primary', '')}
                        className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                      >
                        + ADD PRIMARY OBJECTIVE
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-vault-green/50 font-terminal">═══ BUSINESS MODEL ═══</div>
                  
                  <div>
                    <label className="block text-xs text-vault-green/50 mb-2">DESCRIPTION</label>
                    <textarea
                      value={context.business_context?.business_model?.description || ''}
                      onChange={(e) => updateContext('business_context.business_model.description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                    />
                  </div>
                </div>
              )}

              {/* Use Cases Tab */}
              {activeTab === 'usecases' && (
                <div className="space-y-6">
                  <div className="text-xs text-vault-green/50 font-terminal">═══ PRIMARY USE CASES ═══</div>
                  
                  <div className="space-y-4">
                    {context.use_cases?.primary?.map((useCase, index) => (
                      <div key={index} className="p-4 bg-vault-terminal border border-vault-green/30 space-y-3">
                        <div className="flex justify-between">
                          <input
                            type="text"
                            value={useCase.title}
                            onChange={(e) => {
                              const updated = [...(context.use_cases?.primary || [])];
                              updated[index] = { ...updated[index], title: e.target.value };
                              updateContext('use_cases.primary', updated);
                            }}
                            placeholder="Use Case Title"
                            className="text-sm font-mono text-vault-green bg-transparent border-b border-vault-green/30 focus:outline-none focus:border-vault-green"
                          />
                          <button
                            onClick={() => {
                              const updated = context.use_cases?.primary?.filter((_, i) => i !== index) || [];
                              updateContext('use_cases.primary', updated);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        
                        <textarea
                          value={useCase.description}
                          onChange={(e) => {
                            const updated = [...(context.use_cases?.primary || [])];
                            updated[index] = { ...updated[index], description: e.target.value };
                            updateContext('use_cases.primary', updated);
                          }}
                          placeholder="Description"
                          rows={2}
                          className="w-full px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                        />
                        
                        <input
                          type="text"
                          value={useCase.value_proposition}
                          onChange={(e) => {
                            const updated = [...(context.use_cases?.primary || [])];
                            updated[index] = { ...updated[index], value_proposition: e.target.value };
                            updateContext('use_cases.primary', updated);
                          }}
                          placeholder="Value Proposition"
                          className="w-full px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => addUseCase('primary')}
                      className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                    >
                      + ADD PRIMARY USE CASE
                    </button>
                  </div>
                </div>
              )}

              {/* Metrics Tab */}
              {activeTab === 'metrics' && (
                <div className="space-y-6">
                  <div className="text-xs text-vault-green/50 font-terminal">═══ KEY PERFORMANCE INDICATORS ═══</div>
                  
                  <div className="space-y-4">
                    {context.success_metrics?.kpis?.map((kpi, index) => (
                      <div key={index} className="p-4 bg-vault-terminal border border-vault-green/30">
                        <div className="flex justify-between mb-3">
                          <span className="text-xs text-vault-green/50">KPI #{index + 1}</span>
                          <button
                            onClick={() => {
                              const updated = context.success_metrics?.kpis?.filter((_, i) => i !== index) || [];
                              updateContext('success_metrics.kpis', updated);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={kpi.metric}
                            onChange={(e) => {
                              const updated = [...(context.success_metrics?.kpis || [])];
                              updated[index] = { ...updated[index], metric: e.target.value };
                              updateContext('success_metrics.kpis', updated);
                            }}
                            placeholder="Metric"
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <input
                            type="text"
                            value={kpi.target}
                            onChange={(e) => {
                              const updated = [...(context.success_metrics?.kpis || [])];
                              updated[index] = { ...updated[index], target: e.target.value };
                              updateContext('success_metrics.kpis', updated);
                            }}
                            placeholder="Target"
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <input
                            type="text"
                            value={kpi.timeline}
                            onChange={(e) => {
                              const updated = [...(context.success_metrics?.kpis || [])];
                              updated[index] = { ...updated[index], timeline: e.target.value };
                              updateContext('success_metrics.kpis', updated);
                            }}
                            placeholder="Timeline"
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={addKPI}
                      className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                    >
                      + ADD KPI
                    </button>
                  </div>

                  <div className="text-xs text-vault-green/50 font-terminal">═══ MILESTONES ═══</div>
                  
                  <div className="space-y-4">
                    {context.success_metrics?.milestones?.map((milestone, index) => (
                      <div key={index} className="p-4 bg-vault-terminal border border-vault-green/30">
                        <div className="flex justify-between mb-3">
                          <span className="text-xs text-vault-green/50">MILESTONE #{index + 1}</span>
                          <button
                            onClick={() => {
                              const updated = context.success_metrics?.milestones?.filter((_, i) => i !== index) || [];
                              updateContext('success_metrics.milestones', updated);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={milestone.phase}
                            onChange={(e) => {
                              const updated = [...(context.success_metrics?.milestones || [])];
                              updated[index] = { ...updated[index], phase: e.target.value };
                              updateContext('success_metrics.milestones', updated);
                            }}
                            placeholder="Phase"
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <input
                            type="text"
                            value={milestone.timeline}
                            onChange={(e) => {
                              const updated = [...(context.success_metrics?.milestones || [])];
                              updated[index] = { ...updated[index], timeline: e.target.value };
                              updateContext('success_metrics.milestones', updated);
                            }}
                            placeholder="Timeline"
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <textarea
                            value={milestone.description}
                            onChange={(e) => {
                              const updated = [...(context.success_metrics?.milestones || [])];
                              updated[index] = { ...updated[index], description: e.target.value };
                              updateContext('success_metrics.milestones', updated);
                            }}
                            placeholder="Description"
                            rows={2}
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <textarea
                            value={milestone.success_criteria}
                            onChange={(e) => {
                              const updated = [...(context.success_metrics?.milestones || [])];
                              updated[index] = { ...updated[index], success_criteria: e.target.value };
                              updateContext('success_metrics.milestones', updated);
                            }}
                            placeholder="Success Criteria"
                            rows={2}
                            className="px-2 py-1 bg-vault-surface border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={addMilestone}
                      className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                    >
                      + ADD MILESTONE
                    </button>
                  </div>
                </div>
              )}

              {/* Requirements Tab */}
              {activeTab === 'requirements' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs text-vault-green/50 mb-2 font-terminal">═══ BUSINESS REQUIREMENTS ═══</label>
                    <div className="space-y-2">
                      {context.requirements?.business?.map((req, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={req}
                            onChange={(e) => {
                              const updated = [...(context.requirements?.business || [])];
                              updated[index] = e.target.value;
                              updateContext('requirements.business', updated);
                            }}
                            className="flex-1 px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <button
                            onClick={() => removeArrayItem('requirements.business', index)}
                            className="px-3 py-2 text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayItem('requirements.business', '')}
                        className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                      >
                        + ADD REQUIREMENT
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-vault-green/50 mb-2 font-terminal">═══ OPERATIONAL REQUIREMENTS ═══</label>
                    <div className="space-y-2">
                      {context.requirements?.operational?.map((req, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={req}
                            onChange={(e) => {
                              const updated = [...(context.requirements?.operational || [])];
                              updated[index] = e.target.value;
                              updateContext('requirements.operational', updated);
                            }}
                            className="flex-1 px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <button
                            onClick={() => removeArrayItem('requirements.operational', index)}
                            className="px-3 py-2 text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayItem('requirements.operational', '')}
                        className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                      >
                        + ADD REQUIREMENT
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-vault-green/50 mb-2 font-terminal">═══ FINANCIAL REQUIREMENTS ═══</label>
                    <div className="space-y-2">
                      {context.requirements?.financial?.map((req, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={req}
                            onChange={(e) => {
                              const updated = [...(context.requirements?.financial || [])];
                              updated[index] = e.target.value;
                              updateContext('requirements.financial', updated);
                            }}
                            className="flex-1 px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <button
                            onClick={() => removeArrayItem('requirements.financial', index)}
                            className="px-3 py-2 text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayItem('requirements.financial', '')}
                        className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                      >
                        + ADD REQUIREMENT
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Integration Tab */}
              {activeTab === 'integration' && (
                <div className="space-y-6">
                  <div className="text-xs text-vault-green/50 font-terminal">═══ STAKEHOLDERS ═══</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-vault-green/50 mb-2">EXECUTIVE SPONSOR</label>
                      <input
                        type="text"
                        value={context.stakeholders?.executive_sponsor || ''}
                        onChange={(e) => updateContext('stakeholders.executive_sponsor', e.target.value)}
                        className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-vault-green/50 mb-2">BUSINESS OWNER</label>
                      <input
                        type="text"
                        value={context.stakeholders?.business_owner || ''}
                        onChange={(e) => updateContext('stakeholders.business_owner', e.target.value)}
                        className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-vault-green/50 font-terminal">═══ INTEGRATION LANDSCAPE ═══</div>
                  
                  <div>
                    <label className="block text-xs text-vault-green/50 mb-2">INTERNAL SYSTEMS</label>
                    <div className="space-y-2">
                      {context.integration_landscape?.internal_systems?.map((system, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={system}
                            onChange={(e) => {
                              const updated = [...(context.integration_landscape?.internal_systems || [])];
                              updated[index] = e.target.value;
                              updateContext('integration_landscape.internal_systems', updated);
                            }}
                            className="flex-1 px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <button
                            onClick={() => removeArrayItem('integration_landscape.internal_systems', index)}
                            className="px-3 py-2 text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayItem('integration_landscape.internal_systems', '')}
                        className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                      >
                        + ADD SYSTEM
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-vault-green/50 font-terminal">═══ RISK CONSIDERATIONS ═══</div>
                  
                  <div>
                    <label className="block text-xs text-vault-green/50 mb-2">BUSINESS RISKS</label>
                    <div className="space-y-2">
                      {context.risk_considerations?.business_risks?.map((risk, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={risk}
                            onChange={(e) => {
                              const updated = [...(context.risk_considerations?.business_risks || [])];
                              updated[index] = e.target.value;
                              updateContext('risk_considerations.business_risks', updated);
                            }}
                            className="flex-1 px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                          />
                          <button
                            onClick={() => removeArrayItem('risk_considerations.business_risks', index)}
                            className="px-3 py-2 text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addArrayItem('risk_considerations.business_risks', '')}
                        className="px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all"
                      >
                        + ADD RISK
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
      </Card>
    </div>
  );
};