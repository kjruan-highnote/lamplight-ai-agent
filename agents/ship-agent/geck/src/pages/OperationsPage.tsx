import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Edit2, Trash2, Upload, Download, 
  Code2, Copy, Eye, Filter, Database, Zap, Info,
  ChevronDown, ChevronRight, RefreshCw, FileCode
} from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import { api } from '../lib/api';
import { Operation, OperationVariable } from '../types';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import Editor from '@monaco-editor/react';

export const OperationsPage: React.FC = () => {
  const { theme } = useTheme();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [filteredOperations, setFilteredOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(new Set());
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [migrateModalOpen, setMigrateModalOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [editingOperation, setEditingOperation] = useState<Partial<Operation>>({});
  
  // Form state for new/edit operation
  const [operationForm, setOperationForm] = useState<Partial<Operation>>({
    name: '',
    type: 'query',
    category: '',
    description: '',
    query: '',
    variables: {},
    vendor: '',
    apiType: 'graphql',
    tags: []
  });

  useEffect(() => {
    loadOperations();
  }, []);

  useEffect(() => {
    filterOperations();
  }, [operations, searchTerm, selectedCategory, selectedType, selectedVendor]);

  const loadOperations = async () => {
    try {
      setLoading(true);
      const data = await api.operations.list();
      setOperations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load operations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOperations = () => {
    let filtered = [...operations];
    
    if (searchTerm) {
      filtered = filtered.filter(op => 
        op.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(op => op.category === selectedCategory);
    }
    
    if (selectedType !== 'all') {
      filtered = filtered.filter(op => op.type === selectedType);
    }
    
    if (selectedVendor !== 'all') {
      filtered = filtered.filter(op => op.vendor === selectedVendor);
    }
    
    setFilteredOperations(filtered);
  };

  const getCategories = (): string[] => {
    const categories = new Set(operations.map(op => op.category).filter(Boolean));
    return Array.from(categories).sort() as string[];
  };

  const getVendors = (): string[] => {
    const vendors = new Set(operations.map(op => op.vendor).filter(Boolean));
    return Array.from(vendors).sort() as string[];
  };

  const toggleOperation = (id: string) => {
    const newExpanded = new Set(expandedOperations);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedOperations(newExpanded);
  };

  const handleCreateOperation = () => {
    setOperationForm({
      name: '',
      type: 'query',
      category: '',
      description: '',
      query: '',
      variables: {},
      vendor: '',
      apiType: 'graphql',
      tags: []
    });
    setEditModalOpen(true);
  };

  const handleEditOperation = (operation: Operation) => {
    setOperationForm(operation);
    setSelectedOperation(operation);
    setEditModalOpen(true);
  };

  const handleSaveOperation = async () => {
    try {
      if (selectedOperation?._id) {
        // Update existing
        await api.operations.update(selectedOperation._id, operationForm);
      } else {
        // Create new
        await api.operations.create(operationForm as Omit<Operation, '_id'>);
      }
      await loadOperations();
      setEditModalOpen(false);
      setSelectedOperation(null);
    } catch (error) {
      console.error('Failed to save operation:', error);
    }
  };

  const handleDeleteOperation = async () => {
    if (!selectedOperation?._id) return;
    
    try {
      await api.operations.delete(selectedOperation._id);
      await loadOperations();
      setDeleteModalOpen(false);
      setSelectedOperation(null);
    } catch (error) {
      console.error('Failed to delete operation:', error);
    }
  };

  const handleMigrateOperations = async () => {
    try {
      const result = await api.operations.migrate();
      console.log('Migration result:', result);
      await loadOperations();
      setMigrateModalOpen(false);
    } catch (error) {
      console.error('Migration failed:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const content = await file.text();
      const collection = JSON.parse(content);
      const result = await api.operations.migrate(collection);
      console.log('Migration result:', result);
      await loadOperations();
      setMigrateModalOpen(false);
    } catch (error) {
      console.error('Failed to upload Postman collection:', error);
    }
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'mutation':
        return <Zap size={16} style={{ color: theme.colors.warning }} />;
      case 'subscription':
        return <RefreshCw size={16} style={{ color: theme.colors.info }} />;
      default:
        return <Info size={16} style={{ color: theme.colors.primary }} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ 
            color: theme.colors.primary, 
            fontSize: theme.typography.fontSize['3xl'], 
            fontWeight: theme.typography.fontWeight.bold 
          }}>
            Operations Manager
          </h1>
          <p style={{ 
            color: theme.colors.textMuted, 
            fontSize: theme.typography.fontSize.sm, 
            marginTop: theme.spacing.sm 
          }}>
            Manage GraphQL operations, queries, and mutations
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Database size={16} />}
            onClick={() => setMigrateModalOpen(true)}
          >
            Migrate from Postman
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={handleCreateOperation}
          >
            Add Operation
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card variant="bordered" className="mb-6">
        <div className="p-4 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search operations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <Search 
                  size={20} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2"
                  style={{ color: theme.colors.textMuted }}
                />
              </div>
            </div>
            
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { value: 'all', label: 'All Categories' },
                ...getCategories().map(cat => ({ value: cat, label: cat }))
              ]}
            />
            
            <Select
              value={selectedType}
              onChange={setSelectedType}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'query', label: 'Query' },
                { value: 'mutation', label: 'Mutation' },
                { value: 'subscription', label: 'Subscription' }
              ]}
            />
            
            <Select
              value={selectedVendor}
              onChange={setSelectedVendor}
              options={[
                { value: 'all', label: 'All Vendors' },
                ...getVendors().map(vendor => ({ value: vendor, label: vendor }))
              ]}
            />
          </div>
          
          <div className="flex justify-between items-center">
            <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.fontSize.sm }}>
              {filteredOperations.length} operations found
            </span>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={loadOperations}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Operations List */}
      <div className="space-y-4">
        {loading ? (
          <Card variant="bordered">
            <div className="p-8 text-center">
              <RefreshCw size={32} className="animate-spin mx-auto mb-2" style={{ color: theme.colors.primary }} />
              <p style={{ color: theme.colors.textMuted }}>Loading operations...</p>
            </div>
          </Card>
        ) : filteredOperations.length === 0 ? (
          <Card variant="bordered">
            <div className="p-8 text-center">
              <FileCode size={48} className="mx-auto mb-3 opacity-50" style={{ color: theme.colors.textMuted }} />
              <p style={{ color: theme.colors.textMuted }}>No operations found</p>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={handleCreateOperation}
                className="mt-4"
              >
                Create First Operation
              </Button>
            </div>
          </Card>
        ) : (
          filteredOperations.map(operation => {
            const isExpanded = expandedOperations.has(operation._id || '');
            
            return (
              <Card key={operation._id} variant="bordered">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Expand/Collapse */}
                    <button
                      onClick={() => toggleOperation(operation._id || '')}
                      className="mt-1"
                      style={{ color: theme.colors.textMuted }}
                    >
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    
                    {/* Operation Icon */}
                    <div className="mt-1">
                      {getOperationIcon(operation.type)}
                    </div>
                    
                    {/* Operation Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold" style={{ color: theme.colors.text }}>
                          {operation.name}
                        </h3>
                        <span 
                          className="px-2 py-0.5 text-xs rounded"
                          style={{
                            backgroundColor: theme.colors.primaryBackground,
                            color: theme.colors.primary
                          }}
                        >
                          {operation.type}
                        </span>
                        {operation.category && (
                          <span 
                            className="px-2 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor: theme.colors.secondaryBackground,
                              color: theme.colors.textSecondary
                            }}
                          >
                            {operation.category}
                          </span>
                        )}
                        {operation.vendor && (
                          <span 
                            className="px-2 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor: theme.colors.surface,
                              color: theme.colors.textMuted
                            }}
                          >
                            {operation.vendor}
                          </span>
                        )}
                      </div>
                      
                      {operation.description && (
                        <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                          {operation.description}
                        </p>
                      )}
                      
                      {operation.tags && operation.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {operation.tags.map(tag => (
                            <span 
                              key={tag}
                              className="px-2 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: `${theme.colors.info}20`,
                                color: theme.colors.info
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditOperation(operation)}
                        className="p-2 rounded transition-all"
                        style={{ color: theme.colors.textMuted }}
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
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedOperation(operation);
                          setDeleteModalOpen(true);
                        }}
                        className="p-2 rounded transition-all"
                        style={{ color: theme.colors.textMuted }}
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
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 ml-12 space-y-4">
                      {/* GraphQL Query */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: theme.colors.text }}>
                          GraphQL Query
                        </h4>
                        <div style={{
                          backgroundColor: theme.colors.background,
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: theme.borders.radius.md,
                          overflow: 'hidden'
                        }}>
                          <Editor
                            height="200px"
                            language="graphql"
                            value={operation.query}
                            theme="vs-dark"
                            options={{
                              readOnly: true,
                              minimap: { enabled: false },
                              scrollBeyondLastLine: false,
                              fontSize: 12
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Variables */}
                      {operation.variables && Object.keys(operation.variables).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2" style={{ color: theme.colors.text }}>
                            Variables
                          </h4>
                          <div className="space-y-2">
                            {Object.entries(operation.variables).map(([key, variable]) => (
                              <div 
                                key={key}
                                className="flex items-center gap-4 p-2 rounded"
                                style={{ backgroundColor: theme.colors.surface }}
                              >
                                <span className="font-mono text-sm" style={{ color: theme.colors.primary }}>
                                  ${key}
                                </span>
                                <span className="text-sm" style={{ color: theme.colors.text }}>
                                  {(variable as OperationVariable).type}
                                </span>
                                {(variable as OperationVariable).required && (
                                  <span 
                                    className="px-1.5 py-0.5 text-xs rounded"
                                    style={{
                                      backgroundColor: `${theme.colors.warning}20`,
                                      color: theme.colors.warning
                                    }}
                                  >
                                    Required
                                  </span>
                                )}
                                {(variable as OperationVariable).description && (
                                  <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                                    {(variable as OperationVariable).description}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit/Create Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedOperation(null);
        }}
        title={selectedOperation ? 'Edit Operation' : 'Create Operation'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditModalOpen(false);
                setSelectedOperation(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveOperation}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Name
              </label>
              <Input
                value={operationForm.name || ''}
                onChange={(e) => setOperationForm({ ...operationForm, name: e.target.value })}
                placeholder="e.g., GetCardDetails"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Type
              </label>
              <Select
                value={operationForm.type || 'query'}
                onChange={(value) => setOperationForm({ ...operationForm, type: value as any })}
                options={[
                  { value: 'query', label: 'Query' },
                  { value: 'mutation', label: 'Mutation' },
                  { value: 'subscription', label: 'Subscription' }
                ]}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Category
              </label>
              <Input
                value={operationForm.category || ''}
                onChange={(e) => setOperationForm({ ...operationForm, category: e.target.value })}
                placeholder="e.g., card_management"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Vendor
              </label>
              <Input
                value={operationForm.vendor || ''}
                onChange={(e) => setOperationForm({ ...operationForm, vendor: e.target.value })}
                placeholder="e.g., Highnote"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Description
            </label>
            <Textarea
              value={operationForm.description || ''}
              onChange={(e) => setOperationForm({ ...operationForm, description: e.target.value })}
              placeholder="Describe what this operation does..."
              rows={2}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              GraphQL Query
            </label>
            <div style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borders.radius.md,
              overflow: 'hidden'
            }}>
              <Editor
                height="300px"
                language="graphql"
                value={operationForm.query || ''}
                onChange={(value) => setOperationForm({ ...operationForm, query: value || '' })}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on'
                }}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Tags (comma-separated)
            </label>
            <Input
              value={operationForm.tags?.join(', ') || ''}
              onChange={(e) => setOperationForm({ 
                ...operationForm, 
                tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) 
              })}
              placeholder="e.g., payment, card, kyc"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedOperation(null);
        }}
        onConfirm={handleDeleteOperation}
        title="Delete Operation"
        message={`Are you sure you want to delete "${selectedOperation?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      {/* Migration Modal */}
      <Modal
        isOpen={migrateModalOpen}
        onClose={() => setMigrateModalOpen(false)}
        title="Migrate Operations from Postman"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setMigrateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleMigrateOperations}
              icon={<Database size={16} />}
            >
              Scan & Import
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p style={{ color: theme.colors.textMuted }}>
            You can import operations from Postman collections in two ways:
          </p>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg border" style={{
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface
            }}>
              <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
                Option 1: Upload Collection File
              </h4>
              <p className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
                Export your Postman collection as JSON and upload it here.
              </p>
              <label className="block">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Upload size={16} />}
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input');
                    input?.click();
                  }}
                >
                  Choose File
                </Button>
              </label>
            </div>
            
            <div className="p-4 rounded-lg border" style={{
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface
            }}>
              <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
                Option 2: Scan Server Directory
              </h4>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Click "Scan & Import" to automatically scan and import all Postman collections from the server.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};