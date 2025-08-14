import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Plus, Edit2, Trash2, Upload, Download, 
  Code2, Copy, Eye, Filter, Database, Zap, Info,
  ChevronDown, ChevronRight, RefreshCw, FileCode, GitMerge,
  Variable, Workflow
} from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import { api } from '../lib/api';
import { Operation, OperationVariable } from '../types';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Pagination } from '../components/ui/Pagination';
import { VariableManager } from '../components/operation/VariableManager';
import Editor from '@monaco-editor/react';

export const OperationsPage: React.FC = () => {
  const { theme } = useTheme();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(new Set());
  const [programs, setPrograms] = useState<any[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [migrateModalOpen, setMigrateModalOpen] = useState(false);
  const [deduplicateModalOpen, setDeduplicateModalOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [editingOperation, setEditingOperation] = useState<Partial<Operation>>({});
  
  // Deduplication state
  const [duplicateAnalysis, setDuplicateAnalysis] = useState<any>(null);
  const [deduplicating, setDeduplicating] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<any>(null);
  const [dryRunModalOpen, setDryRunModalOpen] = useState(false);
  
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

  // Load operations with pagination and filters
  const loadOperations = useCallback(async () => {
    try {
      setLoading(true);
      
      const params: any = {
        page: currentPage,
        pageSize: pageSize
      };
      
      // Add filters
      if (searchTerm) params.search = searchTerm;
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (selectedType !== 'all') params.type = selectedType;
      if (selectedVendor !== 'all') params.vendor = selectedVendor;
      
      const response = await api.operations.list(params);
      
      // Handle both paginated and non-paginated responses
      if ('data' in response) {
        setOperations(response.data as Operation[]);
        setTotalCount(response.pagination.totalCount);
        setTotalPages(response.pagination.totalPages);
      } else {
        // Fallback for non-paginated response
        setOperations(Array.isArray(response) ? response : []);
        setTotalCount(operations.length);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to load operations:', error);
      setOperations([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, selectedCategory, selectedType, selectedVendor]);

  // Load metadata for filters (categories and vendors)
  const loadMetadata = async () => {
    try {
      // Load first page without filters to get all categories/vendors
      const response = await api.operations.list({ pageSize: 1000 });
      
      if ('data' in response) {
        const allOps = response.data as Operation[];
        
        // Extract unique categories and vendors
        const uniqueCategories = new Set(allOps.map(op => op.category).filter(Boolean));
        const uniqueVendors = new Set(allOps.map(op => op.vendor).filter(Boolean));
        
        setCategories(Array.from(uniqueCategories).sort() as string[]);
        setVendors(Array.from(uniqueVendors).sort() as string[]);
      }
    } catch (error) {
      console.error('Failed to load metadata:', error);
    }
  };

  // Load programs to check workflow associations
  const loadPrograms = async () => {
    try {
      const response = await api.programs.list();
      setPrograms(response || []);
    } catch (error) {
      console.error('Failed to load programs:', error);
      setPrograms([]);
    }
  };

  // Find workflows that use a specific operation
  const findWorkflowsUsingOperation = (operationName: string) => {
    const workflows: Array<{ programName: string; workflowName: string }> = [];
    
    programs.forEach(program => {
      if (program.workflows) {
        Object.entries(program.workflows).forEach(([workflowKey, workflow]: [string, any]) => {
          if (workflow.steps) {
            const hasOperation = workflow.steps.some((step: any) => 
              step.operation === operationName
            );
            if (hasOperation) {
              workflows.push({
                programName: program.metadata?.name || program.program_type,
                workflowName: workflow.name || workflowKey
              });
            }
          }
        });
      }
    });
    
    return workflows;
  };

  // Load metadata once on mount
  useEffect(() => {
    loadMetadata();
    loadPrograms();
  }, []);

  // Load operations when filters or pagination changes
  useEffect(() => {
    loadOperations();
  }, [loadOperations]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedType, selectedVendor]);

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
    setSelectedOperation(null);
    setEditModalOpen(true);
  };

  const handleEditOperation = (operation: Operation) => {
    setOperationForm({
      ...operation,
      variables: operation.variables || {}
    });
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

  const handleMigrateJsonOperations = async () => {
    try {
      const result = await api.operations.migrateJson();
      console.log('JSON Migration result:', result);
      
      // Show success message with details
      if (result.success) {
        setDryRunResults({
          title: 'Migration Complete',
          isSuccess: true,
          message: result.message,
          stats: result.stats,
          details: result.details
        });
        setDryRunModalOpen(true);
      }
      
      await loadOperations();
      setMigrateModalOpen(false);
    } catch (error) {
      console.error('JSON Migration failed:', error);
      setDryRunResults({
        title: 'Migration Failed',
        isError: true,
        error: error
      });
      setDryRunModalOpen(true);
    }
  };

  const handleAnalyzeDuplicates = async () => {
    try {
      setDeduplicating(true);
      const result = await api.operations.analyzeDuplicates();
      setDuplicateAnalysis(result);
      setDeduplicating(false);
    } catch (error) {
      console.error('Failed to analyze duplicates:', error);
      setDeduplicating(false);
    }
  };

  const handleDeduplicate = async (strategy: 'keep-newest' | 'keep-oldest' | 'keep-import', dryRun: boolean = false) => {
    try {
      setDeduplicating(true);
      const result = await api.operations.deduplicate({ strategy, dryRun });
      
      if (!dryRun && result.success) {
        // Show success modal with results
        setDryRunResults({
          ...result,
          title: 'Deduplication Complete',
          isSuccess: true
        });
        setDryRunModalOpen(true);
        await loadOperations();
        setDeduplicateModalOpen(false);
        setDuplicateAnalysis(null);
      } else if (dryRun) {
        // Show dry run results in modal
        setDryRunResults({
          ...result,
          title: 'Dry Run Results',
          isDryRun: true
        });
        setDryRunModalOpen(true);
      }
      
      setDeduplicating(false);
    } catch (error) {
      console.error('Deduplication failed:', error);
      setDeduplicating(false);
      // Show error in modal
      setDryRunResults({
        title: 'Deduplication Failed',
        isError: true,
        error: error
      });
      setDryRunModalOpen(true);
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
            icon={<GitMerge size={16} />}
            onClick={() => {
              setDeduplicateModalOpen(true);
              handleAnalyzeDuplicates();
            }}
          >
            Deduplicate
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Database size={16} />}
            onClick={() => setMigrateModalOpen(true)}
          >
            Import Operations
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
                ...categories.map(cat => ({ value: cat, label: cat }))
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
                ...vendors.map(vendor => ({ value: vendor, label: vendor }))
              ]}
            />
          </div>
          
          <div className="flex justify-between items-center">
            <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.fontSize.sm }}>
              {totalCount} operations found
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
        ) : operations.length === 0 ? (
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
          operations.map(operation => {
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
                    <div className="flex-1 min-w-0">
                      {/* Title and Type Row */}
                      <div className="flex items-start gap-2 mb-2">
                        <h3 className="font-semibold truncate flex-1" style={{ color: theme.colors.text }}>
                          {operation.name}
                        </h3>
                        <span 
                          className="px-2 py-0.5 text-xs rounded flex-shrink-0"
                          style={{
                            backgroundColor: operation.type === 'mutation' ? `${theme.colors.warning}20` : 
                                           operation.type === 'subscription' ? `${theme.colors.info}20` :
                                           theme.colors.primaryBackground,
                            color: operation.type === 'mutation' ? theme.colors.warning :
                                  operation.type === 'subscription' ? theme.colors.info :
                                  theme.colors.primary
                          }}
                        >
                          {operation.type}
                        </span>
                      </div>
                      
                      {/* Metadata Summary Row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {/* Show primary category and vendor */}
                        <div className="flex items-center gap-1">
                          {operation.category && (
                            <span 
                              className="px-1.5 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: theme.colors.surface,
                                color: theme.colors.textSecondary,
                                fontSize: '11px'
                              }}
                            >
                              {operation.category}
                            </span>
                          )}
                          {operation.vendor && (
                            <>
                              <span style={{ color: theme.colors.textMuted, fontSize: '10px' }}>•</span>
                              <span 
                                className="px-1.5 py-0.5 text-xs rounded"
                                style={{
                                  backgroundColor: theme.colors.surface,
                                  color: theme.colors.textSecondary,
                                  fontSize: '11px'
                                }}
                              >
                                {operation.vendor}
                              </span>
                            </>
                          )}
                        </div>
                        
                        {/* Merged indicator - more compact */}
                        {operation.metadata && (
                          ((operation.metadata.vendors?.length || 0) > 1 || (operation.metadata.categories?.length || 0) > 1) && (
                            <div className="flex items-center gap-1">
                              <span style={{ color: theme.colors.textMuted, fontSize: '10px' }}>•</span>
                              <span 
                                className="px-1.5 py-0.5 text-xs rounded flex items-center gap-1 cursor-help"
                                style={{
                                  backgroundColor: `${theme.colors.info}10`,
                                  color: theme.colors.info,
                                  border: `1px solid ${theme.colors.info}20`,
                                  fontSize: '11px'
                                }}
                                title={`Merged from: ${operation.metadata.categories?.join(', ')} | ${operation.metadata.vendors?.join(', ')}`}
                              >
                                <GitMerge size={10} />
                                {(operation.metadata.vendors?.length || 0) + (operation.metadata.categories?.length || 0)} sources
                              </span>
                            </div>
                          )
                        )}
                        
                        {/* Required badge if true */}
                        {operation.required && (
                          <span 
                            className="px-1.5 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor: `${theme.colors.danger}20`,
                              color: theme.colors.danger,
                              fontSize: '11px',
                              fontWeight: 600
                            }}
                          >
                            Required
                          </span>
                        )}
                      </div>
                      
                      {/* Description - truncated with ellipsis */}
                      {operation.description && (
                        <p className="text-sm line-clamp-2" style={{ 
                          color: theme.colors.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {operation.description}
                        </p>
                      )}
                      
                      {/* Variables and Workflows Info Row */}
                      <div className="flex items-center gap-3 mt-2">
                        {/* Variables Indicator */}
                        {operation.variables && Object.keys(operation.variables).length > 0 && (
                          <div 
                            className="flex items-center gap-1 cursor-help"
                            title={`Variables: ${Object.keys(operation.variables).join(', ')}`}
                          >
                            <Variable size={12} style={{ color: theme.colors.textMuted }} />
                            <span style={{ color: theme.colors.textMuted, fontSize: '11px' }}>
                              {Object.keys(operation.variables).length} variable{Object.keys(operation.variables).length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                        
                        {/* Workflows Using This Operation */}
                        {(() => {
                          const workflows = findWorkflowsUsingOperation(operation.name);
                          return workflows.length > 0 ? (
                            <div 
                              className="flex items-center gap-1 cursor-help"
                              title={`Used in: ${workflows.map(w => `${w.programName} → ${w.workflowName}`).join(', ')}`}
                            >
                              <Workflow size={12} style={{ color: theme.colors.success }} />
                              <span style={{ color: theme.colors.success, fontSize: '11px' }}>
                                {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ) : null;
                        })()}
                        
                        {/* Tags - more compact */}
                        {operation.tags && operation.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span style={{ color: theme.colors.textMuted, fontSize: '10px' }}>•</span>
                            <div className="flex gap-1">
                              {operation.tags.slice(0, 2).map(tag => (
                                <span 
                                  key={tag}
                                  className="px-1 py-0.5 text-xs rounded"
                                  style={{
                                    backgroundColor: theme.colors.background,
                                    color: theme.colors.textMuted,
                                    border: `1px solid ${theme.colors.border}`,
                                    fontSize: '10px'
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                              {operation.tags.length > 2 && (
                                <span 
                                  className="text-xs cursor-help"
                                  style={{ color: theme.colors.textMuted, fontSize: '10px' }}
                                  title={operation.tags.join(', ')}
                                >
                                  +{operation.tags.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
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
                      
                      {/* Merged Metadata Details - Only show if there are multiple sources */}
                      {operation.metadata && ((operation.metadata.categories?.length || 0) > 1 || (operation.metadata.vendors?.length || 0) > 1) && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: theme.colors.text }}>
                            <GitMerge size={14} />
                            Merged from {operation.metadata.sources?.length || 0} Sources
                          </h4>
                          <div className="grid grid-cols-2 gap-3">
                            {/* Categories Column */}
                            {operation.metadata.categories && operation.metadata.categories.length > 0 && (
                              <div className="p-3 rounded" style={{ 
                                backgroundColor: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`
                              }}>
                                <div className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>
                                  Categories ({operation.metadata.categories.length})
                                </div>
                                <div className="space-y-1">
                                  {operation.metadata.categories.map((cat, idx) => (
                                    <div 
                                      key={idx}
                                      className="flex items-center gap-2"
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.colors.primary }} />
                                      <span className="text-xs" style={{ color: theme.colors.text }}>
                                        {cat}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Vendors Column */}
                            {operation.metadata.vendors && operation.metadata.vendors.length > 0 && (
                              <div className="p-3 rounded" style={{ 
                                backgroundColor: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`
                              }}>
                                <div className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>
                                  Vendors ({operation.metadata.vendors.length})
                                </div>
                                <div className="space-y-1">
                                  {operation.metadata.vendors.map((vendor, idx) => (
                                    <div 
                                      key={idx}
                                      className="flex items-center gap-2"
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.colors.info }} />
                                      <span className="text-xs" style={{ color: theme.colors.text }}>
                                        {vendor}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Source Details - Collapsible list */}
                          {operation.metadata.sources && operation.metadata.sources.length > 0 && (
                            <details className="mt-3">
                              <summary className="text-xs cursor-pointer" style={{ color: theme.colors.textMuted }}>
                                View source details
                              </summary>
                              <div className="mt-2 space-y-1">
                                {operation.metadata.sources.map((source, idx) => (
                                  <div 
                                    key={idx}
                                    className="text-xs p-2 rounded flex items-center justify-between"
                                    style={{ 
                                      backgroundColor: theme.colors.background,
                                      border: `1px solid ${theme.colors.border}`
                                    }}
                                  >
                                    <span style={{ color: theme.colors.textSecondary }}>
                                      {source.category} / {source.vendor}
                                    </span>
                                    <span style={{ color: theme.colors.textMuted }}>
                                      {source.source || 'manual'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                      
                      {/* Workflows Using This Operation */}
                      {(() => {
                        const workflows = findWorkflowsUsingOperation(operation.name);
                        return workflows.length > 0 ? (
                          <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: theme.colors.text }}>
                              <Workflow size={14} />
                              Used in Workflows ({workflows.length})
                            </h4>
                            <div className="p-3 rounded" style={{ 
                              backgroundColor: theme.colors.surface,
                              border: `1px solid ${theme.colors.border}`
                            }}>
                              <div className="space-y-2">
                                {workflows.map((workflow, idx) => (
                                  <div 
                                    key={idx}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.colors.success }} />
                                    <span style={{ color: theme.colors.text }}>
                                      <strong>{workflow.programName}</strong>
                                    </span>
                                    <span style={{ color: theme.colors.textMuted }}>→</span>
                                    <span style={{ color: theme.colors.textSecondary }}>
                                      {workflow.workflowName}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}
                      
                      {/* Variables */}
                      {operation.variables && Object.keys(operation.variables).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: theme.colors.text }}>
                            <Variable size={14} />
                            Variables ({Object.keys(operation.variables).length})
                          </h4>
                          <div className="grid gap-2">
                            {Object.entries(operation.variables).map(([key, variable]) => {
                              const varData = variable as OperationVariable;
                              const typeColor = varData.type.includes('!') ? theme.colors.danger :
                                              varData.type.includes('[') ? theme.colors.info :
                                              varData.type === 'ID' ? theme.colors.warning :
                                              varData.type === 'Boolean' ? theme.colors.success :
                                              theme.colors.primary;
                              
                              return (
                                <div 
                                  key={key}
                                  className="flex items-start gap-3 p-3 rounded"
                                  style={{ 
                                    backgroundColor: theme.colors.surface,
                                    border: `1px solid ${theme.colors.border}`
                                  }}
                                >
                                  <span className="font-mono text-sm font-semibold" style={{ color: theme.colors.primary }}>
                                    ${varData.name || key}
                                  </span>
                                  <span 
                                    className="px-2 py-0.5 text-xs font-mono rounded"
                                    style={{
                                      backgroundColor: `${typeColor}20`,
                                      color: typeColor
                                    }}
                                  >
                                    {varData.type}
                                  </span>
                                  {varData.required && (
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
                                  {varData.description && (
                                    <span className="text-sm flex-1" style={{ color: theme.colors.textSecondary }}>
                                      {varData.description}
                                    </span>
                                  )}
                                  {varData.defaultValue !== undefined && (
                                    <span className="text-xs font-mono" style={{ color: theme.colors.textMuted }}>
                                      Default: {JSON.stringify(varData.defaultValue)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setCurrentPage(1); // Reset to first page when page size changes
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      )}

      {/* Edit/Create Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedOperation(null);
        }}
        title={selectedOperation ? 'Edit Operation' : 'Create Operation'}
        size="xl"
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium" style={{ color: theme.colors.text }}>
                GraphQL Query
              </label>
              <button
                onClick={() => {
                  // Insert example query with variables
                  const exampleQuery = operationForm.type === 'mutation' 
                    ? `mutation ${operationForm.name || 'ExampleMutation'}($id: ID!, $input: UpdateInput!) {
  updateEntity(id: $id, input: $input) {
    id
    status
    message
  }
}`
                    : `query ${operationForm.name || 'ExampleQuery'}($id: ID!, $filters: FilterInput) {
  getEntity(id: $id, filters: $filters) {
    id
    name
    status
    createdAt
  }
}`;
                  setOperationForm({ ...operationForm, query: exampleQuery });
                }}
                className="text-xs px-2 py-1 rounded transition-colors"
                style={{
                  backgroundColor: theme.colors.primaryBackground,
                  color: theme.colors.primary,
                  border: `1px solid ${theme.colors.primaryBorder}`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primary;
                  e.currentTarget.style.color = theme.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primaryBackground;
                  e.currentTarget.style.color = theme.colors.primary;
                }}
              >
                Insert Example
              </button>
            </div>
            <div style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borders.radius.md,
              overflow: 'hidden'
            }}>
              <Editor
                height="250px"
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
            <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
              Define variables in your query like: <code style={{ backgroundColor: theme.colors.surface, padding: '2px 4px', borderRadius: '2px' }}>($id: ID!, $name: String)</code>
            </p>
          </div>
          
          <div>
            <VariableManager
              variables={operationForm.variables || {}}
              onChange={(variables) => setOperationForm({ ...operationForm, variables })}
              graphqlQuery={operationForm.query}
            />
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
        title="Import Operations"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setMigrateModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p style={{ color: theme.colors.textMuted }}>
            Choose how you want to import operations:
          </p>
          
          <div className="space-y-4">
            {/* JSON Operations Import */}
            <div className="p-4 rounded-lg border" style={{
              borderColor: theme.colors.primary,
              backgroundColor: `${theme.colors.primary}10`,
              borderWidth: '2px'
            }}>
              <div className="flex items-start gap-3">
                <Database size={24} style={{ color: theme.colors.primary, marginTop: 2 }} />
                <div className="flex-1">
                  <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
                    Import from Operations JSON Files (Recommended)
                  </h4>
                  <p className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
                    Import all operations from the data/operations directory. This includes 51 JSON files with structured operation definitions.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Database size={16} />}
                    onClick={handleMigrateJsonOperations}
                  >
                    Import All Operations JSON
                  </Button>
                </div>
              </div>
            </div>

            {/* Postman Collection Upload */}
            <div className="p-4 rounded-lg border" style={{
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface
            }}>
              <div className="flex items-start gap-3">
                <Upload size={24} style={{ color: theme.colors.textMuted, marginTop: 2 }} />
                <div className="flex-1">
                  <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
                    Upload Postman Collection
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
              </div>
            </div>
            
            {/* Scan Postman Directory */}
            <div className="p-4 rounded-lg border" style={{
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface
            }}>
              <div className="flex items-start gap-3">
                <RefreshCw size={24} style={{ color: theme.colors.textMuted, marginTop: 2 }} />
                <div className="flex-1">
                  <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
                    Scan Postman Collections
                  </h4>
                  <p className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
                    Scan and import all Postman collections from the server directory.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw size={16} />}
                    onClick={handleMigrateOperations}
                  >
                    Scan & Import Postman
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Deduplication Modal */}
      <Modal
        isOpen={deduplicateModalOpen}
        onClose={() => {
          setDeduplicateModalOpen(false);
          setDuplicateAnalysis(null);
        }}
        title="Deduplicate Operations"
        size="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDeduplicateModalOpen(false);
                setDuplicateAnalysis(null);
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {deduplicating ? (
            <div className="text-center py-8">
              <RefreshCw size={32} className="animate-spin mx-auto mb-2" style={{ color: theme.colors.primary }} />
              <p style={{ color: theme.colors.textMuted }}>Analyzing duplicates...</p>
            </div>
          ) : duplicateAnalysis ? (
            <>
              {/* Statistics */}
              <div className="grid grid-cols-4 gap-4">
                <Card variant="bordered" className="p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
                    {duplicateAnalysis.stats.totalOperations}
                  </div>
                  <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                    Total Operations
                  </div>
                </Card>
                <Card variant="bordered" className="p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color: theme.colors.warning }}>
                    {duplicateAnalysis.stats.totalDuplicates}
                  </div>
                  <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                    Duplicates Found
                  </div>
                </Card>
                <Card variant="bordered" className="p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color: theme.colors.info }}>
                    {duplicateAnalysis.stats.totalGroups}
                  </div>
                  <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                    Duplicate Groups
                  </div>
                </Card>
                <Card variant="bordered" className="p-4 text-center">
                  <div className="text-2xl font-bold" style={{ color: theme.colors.danger }}>
                    {duplicateAnalysis.stats.percentDuplicated}
                  </div>
                  <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                    Duplicated
                  </div>
                </Card>
              </div>

              {duplicateAnalysis.stats.totalDuplicates > 0 && (
                <>
                  {/* Deduplication Strategy */}
                  <Card variant="bordered" className="p-4">
                    <h4 className="font-semibold mb-3" style={{ color: theme.colors.text }}>
                      Deduplication Strategy
                    </h4>
                    <p className="text-sm mb-4" style={{ color: theme.colors.textSecondary }}>
                      Choose how to handle duplicates. The system will merge useful information from duplicates before removing them.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded border" style={{ borderColor: theme.colors.border }}>
                        <div>
                          <div className="font-medium" style={{ color: theme.colors.text }}>
                            Keep Newest (Recommended)
                          </div>
                          <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                            Keep the most recently updated operation
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeduplicate('keep-newest', true)}
                          >
                            Dry Run
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`This will remove ${duplicateAnalysis.stats.totalDuplicates} duplicate operations. Continue?`)) {
                                handleDeduplicate('keep-newest', false);
                              }
                            }}
                          >
                            Execute
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded border" style={{ borderColor: theme.colors.border }}>
                        <div>
                          <div className="font-medium" style={{ color: theme.colors.text }}>
                            Keep Oldest
                          </div>
                          <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                            Keep the original operation (first created)
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeduplicate('keep-oldest', true)}
                          >
                            Dry Run
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`This will remove ${duplicateAnalysis.stats.totalDuplicates} duplicate operations. Continue?`)) {
                                handleDeduplicate('keep-oldest', false);
                              }
                            }}
                          >
                            Execute
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded border" style={{ borderColor: theme.colors.border }}>
                        <div>
                          <div className="font-medium" style={{ color: theme.colors.text }}>
                            Keep Imported
                          </div>
                          <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                            Prefer operations from import source
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeduplicate('keep-import', true)}
                          >
                            Dry Run
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              if (window.confirm(`This will remove ${duplicateAnalysis.stats.totalDuplicates} duplicate operations. Continue?`)) {
                                handleDeduplicate('keep-import', false);
                              }
                            }}
                          >
                            Execute
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Duplicate Groups Preview */}
                  <Card variant="bordered" className="p-4">
                    <h4 className="font-semibold mb-3" style={{ color: theme.colors.text }}>
                      Duplicate Groups (Top 10)
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {duplicateAnalysis.duplicateGroups.slice(0, 10).map((group: any, index: number) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-2 rounded"
                          style={{ backgroundColor: theme.colors.surface }}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-sm" style={{ color: theme.colors.text }}>
                              {group.name}
                            </div>
                            <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                              Categories: {group.categories?.join(', ') || 'N/A'} | Vendors: {group.vendors?.join(', ') || 'N/A'}
                            </div>
                          </div>
                          <div className="text-sm px-2 py-1 rounded" style={{
                            backgroundColor: `${theme.colors.warning}20`,
                            color: theme.colors.warning
                          }}>
                            {group.count} copies ({group.duplicates} duplicates)
                          </div>
                        </div>
                      ))}
                      {duplicateAnalysis.duplicateGroups.length > 10 && (
                        <div className="text-sm text-center pt-2" style={{ color: theme.colors.textMuted }}>
                          And {duplicateAnalysis.duplicateGroups.length - 10} more groups...
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}

              {duplicateAnalysis.stats.totalDuplicates === 0 && (
                <Card variant="bordered" className="p-8 text-center">
                  <Info size={48} className="mx-auto mb-3" style={{ color: theme.colors.success }} />
                  <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                    No Duplicates Found
                  </h3>
                  <p style={{ color: theme.colors.textSecondary }}>
                    Your operations collection is already deduplicated!
                  </p>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p style={{ color: theme.colors.textMuted }}>Click analyze to scan for duplicate operations</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Dry Run / Results Modal */}
      <Modal
        isOpen={dryRunModalOpen}
        onClose={() => {
          setDryRunModalOpen(false);
          setDryRunResults(null);
        }}
        title={dryRunResults?.title || 'Results'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            {dryRunResults?.isDryRun && !dryRunResults?.isError && (
              <Button
                variant="primary"
                onClick={() => {
                  setDryRunModalOpen(false);
                  // Execute the actual deduplication
                  if (dryRunResults.strategy) {
                    handleDeduplicate(dryRunResults.strategy, false);
                  }
                }}
                icon={<GitMerge size={16} />}
              >
                Execute Deduplication
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setDryRunModalOpen(false);
                setDryRunResults(null);
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {dryRunResults?.isError ? (
            <Card variant="bordered" className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full" style={{ backgroundColor: `${theme.colors.danger}20` }}>
                  <Info size={20} style={{ color: theme.colors.danger }} />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold mb-2" style={{ color: theme.colors.danger }}>
                    Operation Failed
                  </h4>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    {dryRunResults.error?.message || 'An unexpected error occurred'}
                  </p>
                </div>
              </div>
            </Card>
          ) : dryRunResults?.results || dryRunResults?.stats ? (
            <>
              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-4">
                {dryRunResults.results && (
                  <>
                    <Card variant="bordered" className="p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
                        {dryRunResults.results.processed}
                      </div>
                      <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                        Groups {dryRunResults.isDryRun ? 'To Process' : 'Processed'}
                      </div>
                    </Card>
                    <Card variant="bordered" className="p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.colors.success }}>
                        {dryRunResults.results.kept}
                      </div>
                      <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                        Operations {dryRunResults.isDryRun ? 'To Keep' : 'Kept'}
                      </div>
                    </Card>
                    <Card variant="bordered" className="p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.colors.warning }}>
                        {dryRunResults.results.removed}
                      </div>
                      <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                        Duplicates {dryRunResults.isDryRun ? 'To Remove' : 'Removed'}
                      </div>
                    </Card>
                  </>
                )}
                
                {dryRunResults.stats && (
                  <>
                    <Card variant="bordered" className="p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
                        {dryRunResults.stats.filesProcessed || dryRunResults.stats.totalOperations}
                      </div>
                      <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                        {dryRunResults.stats.filesProcessed ? 'Files Processed' : 'Total Operations'}
                      </div>
                    </Card>
                    <Card variant="bordered" className="p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.colors.success }}>
                        {dryRunResults.stats.inserted}
                      </div>
                      <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                        Inserted
                      </div>
                    </Card>
                    <Card variant="bordered" className="p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: theme.colors.info }}>
                        {dryRunResults.stats.updated}
                      </div>
                      <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                        Updated
                      </div>
                    </Card>
                  </>
                )}
              </div>

              {/* Strategy Information */}
              {dryRunResults.strategy && (
                <Card variant="bordered" className="p-4">
                  <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
                    Deduplication Strategy
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded text-sm font-medium" style={{
                      backgroundColor: theme.colors.primaryBackground,
                      color: theme.colors.primary
                    }}>
                      {dryRunResults.strategy === 'keep-newest' && 'Keep Newest'}
                      {dryRunResults.strategy === 'keep-oldest' && 'Keep Oldest'}
                      {dryRunResults.strategy === 'keep-import' && 'Keep Imported'}
                    </span>
                    <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      {dryRunResults.strategy === 'keep-newest' && 'Retaining the most recently updated version of each operation'}
                      {dryRunResults.strategy === 'keep-oldest' && 'Retaining the original version of each operation'}
                      {dryRunResults.strategy === 'keep-import' && 'Preferring operations from import sources'}
                    </span>
                  </div>
                </Card>
              )}

              {/* Detailed Results */}
              {dryRunResults.results?.details && dryRunResults.results.details.length > 0 && (
                <Card variant="bordered" className="p-4">
                  <h4 className="font-semibold mb-3" style={{ color: theme.colors.text }}>
                    Operation Details (First 10)
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {dryRunResults.results.details.slice(0, 10).map((detail: any, index: number) => (
                      <div 
                        key={index}
                        className="p-3 rounded border"
                        style={{ 
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-sm" style={{ color: theme.colors.text }}>
                              {detail.group}
                            </div>
                            {detail.mergedMetadata && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {detail.mergedMetadata.categories?.map((cat: string, idx: number) => (
                                  <span 
                                    key={`cat-${idx}`}
                                    className="px-1.5 py-0.5 text-xs rounded"
                                    style={{
                                      backgroundColor: theme.colors.primaryBackground,
                                      color: theme.colors.primary
                                    }}
                                  >
                                    {cat}
                                  </span>
                                ))}
                                {detail.mergedMetadata.vendors?.map((vendor: string, idx: number) => (
                                  <span 
                                    key={`vendor-${idx}`}
                                    className="px-1.5 py-0.5 text-xs rounded"
                                    style={{
                                      backgroundColor: theme.colors.secondaryBackground,
                                      color: theme.colors.textSecondary
                                    }}
                                  >
                                    {vendor}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-xs px-2 py-1 rounded" style={{
                            backgroundColor: `${theme.colors.warning}20`,
                            color: theme.colors.warning
                          }}>
                            {detail.removed?.length || 0} {dryRunResults.isDryRun ? 'to remove' : 'removed'}
                          </div>
                        </div>
                      </div>
                    ))}
                    {dryRunResults.results.details.length > 10 && (
                      <div className="text-sm text-center pt-2" style={{ color: theme.colors.textMuted }}>
                        And {dryRunResults.results.details.length - 10} more operations...
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Success Message */}
              {dryRunResults.isSuccess && (
                <Card variant="bordered" className="p-4" style={{ 
                  backgroundColor: `${theme.colors.success}10`,
                  borderColor: theme.colors.success 
                }}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full" style={{ backgroundColor: `${theme.colors.success}20` }}>
                      <Info size={20} style={{ color: theme.colors.success }} />
                    </div>
                    <div>
                      <h4 className="font-semibold" style={{ color: theme.colors.success }}>
                        Operation Successful
                      </h4>
                      <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                        {dryRunResults.message || 'The operation completed successfully.'}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Dry Run Notice */}
              {dryRunResults.isDryRun && !dryRunResults.isError && (
                <Card variant="bordered" className="p-4" style={{ 
                  backgroundColor: `${theme.colors.info}10`,
                  borderColor: theme.colors.info 
                }}>
                  <div className="flex items-center gap-3">
                    <Info size={20} style={{ color: theme.colors.info }} />
                    <div>
                      <h4 className="font-semibold" style={{ color: theme.colors.info }}>
                        Dry Run Mode
                      </h4>
                      <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                        This is a preview of what would happen. No changes have been made to your data.
                        Click "Execute Deduplication" below to apply these changes.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p style={{ color: theme.colors.textMuted }}>No results to display</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};