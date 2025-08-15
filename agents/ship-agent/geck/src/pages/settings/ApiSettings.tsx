import React, { useState, useEffect } from 'react';
import {
  Key, Save, Eye, EyeOff, TestTube, AlertCircle, CheckCircle, RefreshCw,
  Zap, Globe, Webhook, Shield, Activity, Clock, Info,
  FileJson, PlayCircle, Copy, Database, Sparkles
} from 'lucide-react';
import { VaultButton } from '../../components/VaultButton';
import { VaultInput } from '../../components/VaultInput';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { api } from '../../lib/api';
import { useTheme } from '../../themes/ThemeContext';
import Editor from '@monaco-editor/react';
import { EnrichOperationsModal } from '../../components/modals/EnrichOperationsModal';

interface IntegrationStatus {
  name: string;
  type: 'api' | 'webhook' | 'database' | 'external';
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastCheck?: Date;
  message?: string;
  icon: React.ReactNode;
}

interface SchemaInfo {
  queries: number;
  mutations: number;
  subscriptions: number;
  types: number;
  lastUpdated?: string;
}

export const ApiSettings: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'overview' | 'api' | 'schema' | 'webhooks' | 'playground'>('overview');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [endpoint, setEndpoint] = useState('https://api.us.test.highnote.com/graphql');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [schemaInfo, setSchemaInfo] = useState<SchemaInfo | null>(null);
  const [playgroundQuery, setPlaygroundQuery] = useState('');
  const [playgroundVariables, setPlaygroundVariables] = useState('{}');
  const [playgroundResult, setPlaygroundResult] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);

  useEffect(() => {
    // Load saved API key from localStorage
    const savedKey = localStorage.getItem('highnote_api_key');
    const savedEndpoint = localStorage.getItem('highnote_endpoint');
    if (savedKey) setApiKey(savedKey);
    if (savedEndpoint) setEndpoint(savedEndpoint);
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = () => {
    const mockIntegrations: IntegrationStatus[] = [
      {
        name: 'Highnote GraphQL API',
        type: 'api',
        status: apiKey ? 'connected' : 'disconnected',
        lastCheck: new Date(),
        message: apiKey ? 'API key configured' : 'No API key configured',
        icon: <Globe size={20} />
      },
      {
        name: 'MongoDB Database',
        type: 'database',
        status: 'connected',
        lastCheck: new Date(),
        message: 'Database connected',
        icon: <Database size={20} />
      },
      {
        name: 'Webhook Endpoints',
        type: 'webhook',
        status: webhookUrl ? 'connected' : 'disconnected',
        message: webhookUrl ? 'Webhook configured' : 'No webhooks configured',
        icon: <Webhook size={20} />
      },
      {
        name: 'Schema Introspection',
        type: 'external',
        status: schemaInfo ? 'connected' : 'pending',
        message: schemaInfo ? 'Schema loaded' : 'Schema not loaded',
        icon: <FileJson size={20} />
      }
    ];
    setIntegrations(mockIntegrations);
  };

  const handleSave = () => {
    setSaving(true);
    // Save to localStorage
    localStorage.setItem('highnote_api_key', apiKey);
    localStorage.setItem('highnote_endpoint', endpoint);
    
    setTimeout(() => {
      setSaving(false);
      setTestResult({ success: true, message: 'Settings saved successfully' });
      setTimeout(() => setTestResult(null), 3000);
    }, 500);
  };

  const handleTest = async () => {
    if (!apiKey) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await api.schema.introspect(apiKey);
      
      if (result.success && result.summary) {
        setSchemaInfo({
          queries: result.summary.queries.length,
          mutations: result.summary.mutations.length,
          subscriptions: result.summary.subscriptions.length,
          types: result.totalTypes || 0,
          lastUpdated: new Date().toISOString()
        });
        setTestResult({ 
          success: true, 
          message: `Successfully connected! Found ${result.summary?.queries.length || 0} queries and ${result.summary?.mutations.length || 0} mutations.`
        });
        loadIntegrationStatus();
      } else {
        setTestResult({ success: false, message: 'Failed to connect to API' });
      }
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: error.message || 'Connection failed. Please check your API key and endpoint.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleRunQuery = async () => {
    if (!apiKey) {
      setTestResult({ success: false, message: 'Please configure API key first' });
      return;
    }

    setLoading(true);
    try {
      // Highnote uses Basic auth with base64 encoded API key
      // Format: apikey: (API key as username, empty password)
      const encodedAuth = btoa(`${apiKey}:`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${encodedAuth}`
        },
        body: JSON.stringify({
          query: playgroundQuery,
          variables: JSON.parse(playgroundVariables)
        })
      });

      const result = await response.json();
      setPlaygroundResult(JSON.stringify(result, null, 2));
    } catch (error: any) {
      setPlaygroundResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: IntegrationStatus['status']) => {
    switch (status) {
      case 'connected': return theme.colors.success;
      case 'disconnected': return theme.colors.textMuted;
      case 'error': return theme.colors.danger;
      case 'pending': return theme.colors.warning;
      default: return theme.colors.textMuted;
    }
  };

  const getStatusIcon = (status: IntegrationStatus['status']) => {
    switch (status) {
      case 'connected': return <CheckCircle size={16} />;
      case 'disconnected': return <AlertCircle size={16} />;
      case 'error': return <AlertCircle size={16} />;
      case 'pending': return <Clock size={16} />;
      default: return <Info size={16} />;
    }
  };

  const handleEnrichOperations = () => {
    if (!apiKey) {
      setTestResult({ success: false, message: 'Please configure API key first' });
      return;
    }
    setEnrichModalOpen(true);
  };

  const handleEnrichmentSuccess = () => {
    setTestResult({ 
      success: true, 
      message: 'Operations successfully enriched with schema data!'
    });
    loadIntegrationStatus();
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Activity size={16} /> },
    { id: 'api', label: 'API Configuration', icon: <Key size={16} /> },
    { id: 'schema', label: 'Schema Explorer', icon: <FileJson size={16} /> },
    { id: 'webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
    { id: 'playground', label: 'API Playground', icon: <PlayCircle size={16} /> }
  ];

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: theme.colors.primary }}>
          <Zap size={28} />
          API & Integrations
        </h1>
        <p className="text-sm mt-2" style={{ color: theme.colors.textMuted }}>
          Configure API connections, webhooks, and external integrations
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: theme.colors.border }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 flex items-center gap-2 transition-all border-b-2 ${
              activeTab === tab.id ? 'border-current' : 'border-transparent'
            }`}
            style={{
              color: activeTab === tab.id ? theme.colors.primary : theme.colors.textMuted,
              borderColor: activeTab === tab.id ? theme.colors.primary : 'transparent'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {integrations.map((integration, index) => (
              <Card key={index} variant="bordered">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg" style={{ 
                      backgroundColor: `${getStatusColor(integration.status)}20`,
                      color: getStatusColor(integration.status)
                    }}>
                      {integration.icon}
                    </div>
                    {getStatusIcon(integration.status)}
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{integration.name}</h3>
                  <p className="text-xs" style={{ color: theme.colors.textMuted }}>
                    {integration.message}
                  </p>
                  {integration.lastCheck && (
                    <p className="text-xs mt-2" style={{ color: theme.colors.textMuted }}>
                      Last checked: {new Date(integration.lastCheck).toLocaleTimeString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {schemaInfo && (
            <Card variant="bordered">
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileJson size={20} />
                  Schema Statistics
                </h2>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
                      {schemaInfo.queries}
                    </p>
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>Queries</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: theme.colors.success }}>
                      {schemaInfo.mutations}
                    </p>
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>Mutations</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: theme.colors.warning }}>
                      {schemaInfo.subscriptions}
                    </p>
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>Subscriptions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: theme.colors.info }}>
                      {schemaInfo.types}
                    </p>
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>Types</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* API Configuration Tab */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="text-primary" size={24} />
            API Configuration
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            Configure your Highnote API credentials to enable schema introspection and operation enrichment.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              API Endpoint
            </label>
            <VaultInput
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.us.test.highnote.com/graphql"
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              The GraphQL endpoint for your Highnote environment
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              API Key
            </label>
            <div className="relative">
              <VaultInput
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Highnote API key"
                className="pr-10 font-mono text-sm"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Your API key is stored locally in your browser. Highnote uses Basic authentication with base64 encoding.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Format: The API key will be automatically encoded as Basic auth (base64 encoded with ':' prefix)
            </p>
          </div>

          {testResult && (
            <div className={`p-3 rounded-lg border ${
              testResult.success 
                ? 'bg-green-900/20 border-green-500/50 text-green-400'
                : 'bg-red-900/20 border-red-500/50 text-red-400'
            }`}>
              <div className="flex items-start gap-2">
                {testResult.success ? (
                  <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                )}
                <p className="text-sm">{testResult.message}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <VaultButton
              onClick={handleTest}
              disabled={testing || !apiKey}
              variant="secondary"
            >
              {testing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube size={16} />
                  Test Connection
                </>
              )}
            </VaultButton>

            <VaultButton
              onClick={handleSave}
              disabled={saving || !apiKey}
              variant="primary"
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Settings
                </>
              )}
            </VaultButton>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Schema Enrichment</h3>
          <p className="text-sm text-gray-400 mt-1">
            Enrich your operations with type information from the live GraphQL schema
          </p>
        </CardHeader>
        <CardContent>
          <VaultButton
            onClick={handleEnrichOperations}
            disabled={testing || !apiKey}
            variant="primary"
            className="w-full"
          >
            <Sparkles size={16} />
            Enrich All Operations with Schema
          </VaultButton>
          <p className="text-xs text-gray-500 mt-2">
            This will fetch the latest schema and update all operations with detailed input type information. 
            A preview will be shown before any changes are made.
          </p>
        </CardContent>
      </Card>
        </div>
      )}

      {/* Schema Explorer Tab */}
      {activeTab === 'schema' && (
        <SchemaExplorer apiKey={apiKey} endpoint={endpoint} theme={theme} />
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-6">
          <Card variant="bordered">
            <CardHeader>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Webhook size={20} />
                Webhook Configuration
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Webhook URL
                </label>
                <VaultInput
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-domain.com/webhook"
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Event Types
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    'account.created',
                    'account.updated',
                    'card.issued',
                    'card.activated',
                    'transaction.created',
                    'transaction.settled'
                  ].map(event => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webhookEvents.includes(event)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWebhookEvents([...webhookEvents, event]);
                          } else {
                            setWebhookEvents(webhookEvents.filter(e => e !== event));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <VaultButton
                onClick={() => alert('Webhook configuration saved!')}
                variant="primary"
                disabled={!webhookUrl}
              >
                Save Webhook Configuration
              </VaultButton>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Playground Tab */}
      {activeTab === 'playground' && (
        <div className="space-y-6">
          <Card variant="bordered">
            <CardHeader>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <PlayCircle size={20} />
                GraphQL Playground
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Query
                </label>
                <div style={{ height: '300px', border: `1px solid ${theme.colors.border}`, borderRadius: '8px' }}>
                  <Editor
                    theme={theme.isDark ? 'vs-dark' : 'light'}
                    language="graphql"
                    value={playgroundQuery}
                    onChange={(value) => setPlaygroundQuery(value || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Variables
                </label>
                <div style={{ height: '150px', border: `1px solid ${theme.colors.border}`, borderRadius: '8px' }}>
                  <Editor
                    theme={theme.isDark ? 'vs-dark' : 'light'}
                    language="json"
                    value={playgroundVariables}
                    onChange={(value) => setPlaygroundVariables(value || '{}')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false
                    }}
                  />
                </div>
              </div>

              <VaultButton
                onClick={handleRunQuery}
                variant="primary"
                disabled={loading || !apiKey || !playgroundQuery}
                className="w-full"
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <PlayCircle size={16} />
                )}
                Run Query
              </VaultButton>

              {playgroundResult && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Result
                  </label>
                  <div style={{ height: '300px', border: `1px solid ${theme.colors.border}`, borderRadius: '8px' }}>
                    <Editor
                      theme={theme.isDark ? 'vs-dark' : 'light'}
                      language="json"
                      value={playgroundResult}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Enrich Operations Modal */}
      <EnrichOperationsModal
        isOpen={enrichModalOpen}
        onClose={() => setEnrichModalOpen(false)}
        apiKey={apiKey}
        endpoint={endpoint}
        onSuccess={handleEnrichmentSuccess}
      />
    </div>
  );
};

// Schema Explorer Component
const SchemaExplorer: React.FC<{ apiKey: string; endpoint: string; theme: any }> = ({ apiKey, endpoint, theme }) => {
  const [schemaData, setSchemaData] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadSchema = async () => {
    if (!apiKey) {
      alert('Please configure API key first');
      return;
    }

    setLoading(true);
    try {
      const result = await api.schema.introspect(apiKey);
      if (result.success) {
        setSchemaData(result);
      }
    } catch (error) {
      console.error('Failed to load schema:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey) {
      loadSchema();
    }
    // eslint-disable-next-line
  }, [apiKey]);

  const filteredTypes = schemaData?.inputTypes?.filter((type: any) =>
    type.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <Card variant="bordered">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileJson size={20} />
              Schema Explorer
            </h2>
            <VaultButton
              onClick={loadSchema}
              variant="secondary"
              size="sm"
              disabled={loading || !apiKey}
            >
              {loading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Refresh Schema
            </VaultButton>
          </div>
        </CardHeader>
        <CardContent>
          {!apiKey ? (
            <div className="text-center py-8">
              <AlertCircle size={48} className="mx-auto mb-4" style={{ color: theme.colors.warning }} />
              <p style={{ color: theme.colors.textMuted }}>
                Please configure your API key to explore the schema
              </p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <RefreshCw size={48} className="mx-auto mb-4 animate-spin" style={{ color: theme.colors.primary }} />
              <p style={{ color: theme.colors.textMuted }}>Loading schema...</p>
            </div>
          ) : schemaData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <VaultInput
                  type="text"
                  placeholder="Search types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredTypes.map((type: any) => (
                    <button
                      key={type.name}
                      onClick={() => setSelectedType(type.name)}
                      className={`w-full text-left p-2 rounded-lg transition-all ${
                        selectedType === type.name ? 'bg-opacity-20' : ''
                      }`}
                      style={{
                        backgroundColor: selectedType === type.name ? `${theme.colors.primary}20` : 'transparent',
                        borderLeft: selectedType === type.name ? `3px solid ${theme.colors.primary}` : '3px solid transparent'
                      }}
                    >
                      <p className="text-sm font-medium">{type.name}</p>
                      {type.description && (
                        <p className="text-xs" style={{ color: theme.colors.textMuted }}>
                          {type.description}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                {selectedType ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">{selectedType}</h3>
                    {(() => {
                      const type = filteredTypes.find((t: any) => t.name === selectedType);
                      return type?.fields ? (
                        <div className="space-y-2">
                          {type.fields.map((field: any) => (
                            <div key={field.name} className="p-3 rounded-lg" style={{
                              backgroundColor: theme.colors.surface,
                              border: `1px solid ${theme.colors.border}`
                            }}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-mono text-sm">
                                    {field.name}
                                    {field.type.required && <span className="text-red-400 ml-1">*</span>}
                                  </p>
                                  <p className="text-xs mt-1" style={{ color: theme.colors.primary }}>
                                    {field.type.isList ? `[${field.type.name}]` : field.type.name}
                                  </p>
                                  {field.description && (
                                    <p className="text-xs mt-2" style={{ color: theme.colors.textMuted }}>
                                      {field.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: theme.colors.textMuted }}>No fields available</p>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Info size={48} className="mx-auto mb-4" style={{ color: theme.colors.textMuted }} />
                    <p style={{ color: theme.colors.textMuted }}>
                      Select a type to view its fields
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle size={48} className="mx-auto mb-4" style={{ color: theme.colors.warning }} />
              <p style={{ color: theme.colors.textMuted }}>
                Failed to load schema. Please check your API configuration.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};