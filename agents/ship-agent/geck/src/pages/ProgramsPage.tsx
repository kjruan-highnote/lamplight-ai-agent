import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, Plus, Edit, Copy, Trash2, FileCode, 
  RefreshCw, Filter, Package, Users, Archive,
  ChevronRight, Download, Upload, Shield, Zap,
  Check, AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { ProgramConfig } from '../types';
import { useTheme } from '../themes/ThemeContext';
import { VaultSelect } from '../components/VaultSelect';
import { VaultSearch } from '../components/VaultInput';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { InputModal, ConfirmModal } from '../components/ui/Modal';

export const ProgramsPage: React.FC = () => {
  const { theme } = useTheme();
  const [programs, setPrograms] = useState<ProgramConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'templates' | 'subscribers'>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  // Modal states
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<ProgramConfig | null>(null);

  const fetchPrograms = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.programs.list();
      setPrograms(data);
    } catch (err) {
      console.error('Failed to fetch programs:', err);
      setError('Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  // Get unique vendors for filter
  const vendors = Array.from(new Set(programs.map(p => p.vendor).filter(Boolean)));

  // Filter programs based on search and filters
  const filteredPrograms = programs.filter(program => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      program.program_type?.toLowerCase().includes(searchLower) ||
      program.metadata?.name?.toLowerCase().includes(searchLower) ||
      program.vendor?.toLowerCase().includes(searchLower) ||
      program.api_type?.toLowerCase().includes(searchLower);
    
    const matchesView = 
      viewMode === 'all' ||
      (viewMode === 'templates' && program.program_class === 'template') ||
      (viewMode === 'subscribers' && program.program_class === 'subscriber');
    
    // Vendor filter removed - focusing on Highnote Inc. only
    
    const matchesStatus = 
      selectedStatus === 'all' || program.status === selectedStatus;
    
    return matchesSearch && matchesView && matchesStatus;
  });

  const handleDelete = async () => {
    if (selectedProgram?._id) {
      try {
        await api.programs.delete(selectedProgram._id);
        await fetchPrograms();
        setDeleteModalOpen(false);
        setSelectedProgram(null);
      } catch (err) {
        console.error('Failed to delete program:', err);
        setError('Failed to delete program');
      }
    }
  };

  const handleDuplicate = async (newName: string) => {
    if (selectedProgram?._id) {
      try {
        await api.programs.duplicate(selectedProgram._id, newName);
        await fetchPrograms();
        setCopyModalOpen(false);
        setSelectedProgram(null);
      } catch (err) {
        console.error('Failed to duplicate program:', err);
        setError('Failed to duplicate program');
      }
    }
  };

  const openCopyModal = (program: ProgramConfig) => {
    setSelectedProgram(program);
    setCopyModalOpen(true);
  };

  const openDeleteModal = (program: ProgramConfig) => {
    setSelectedProgram(program);
    setDeleteModalOpen(true);
  };

  const handleExportYAML = (program: ProgramConfig) => {
    // Convert program to YAML format and download
    const yaml = convertProgramToYAML(program);
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${program.program_type}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFromYAML = async () => {
    setImporting(true);
    setImportResult(null);
    setError(null);
    
    try {
      const response = await api.programs.import();
      setImportResult(response);
      
      if (response.success) {
        // Refresh the programs list
        await fetchPrograms();
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      setError(err.message || 'Failed to import programs from YAML');
    } finally {
      setImporting(false);
    }
  };

  // Helper function to convert program to YAML (simplified)
  const convertProgramToYAML = (program: ProgramConfig): string => {
    // This would use js-yaml in reality
    return `# ${program.metadata?.name || 'Program Configuration'}
program_type: ${program.program_type}
vendor: ${program.vendor}
version: ${program.version}
api_type: ${program.api_type}

metadata:
  name: "${program.metadata?.name}"
  description: "${program.metadata?.description}"
  base_url: "${program.metadata?.base_url}"
  authentication:
    type: ${program.metadata?.authentication?.type}
    header: ${program.metadata?.authentication?.header}

capabilities:
${program.capabilities?.map(cap => `  - ${cap}`).join('\n')}
`;
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return (
          <span style={{
            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
            fontSize: theme.typography.fontSize.xs,
            backgroundColor: `${theme.colors.success}20`,
            color: theme.colors.success,
            borderRadius: theme.borders.radius.sm
          }}>ACTIVE</span>
        );
      case 'draft':
        return (
          <span style={{
            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
            fontSize: theme.typography.fontSize.xs,
            backgroundColor: `${theme.colors.warning}20`,
            color: theme.colors.warning,
            borderRadius: theme.borders.radius.sm
          }}>DRAFT</span>
        );
      case 'archived':
        return (
          <span style={{
            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
            fontSize: theme.typography.fontSize.xs,
            backgroundColor: theme.colors.secondaryBackground,
            color: theme.colors.textMuted,
            borderRadius: theme.borders.radius.sm
          }}>ARCHIVED</span>
        );
      default:
        return (
          <span style={{
            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
            fontSize: theme.typography.fontSize.xs,
            backgroundColor: theme.colors.secondaryBackground,
            color: theme.colors.textMuted,
            borderRadius: theme.borders.radius.sm
          }}>UNKNOWN</span>
        );
    }
  };

  const getProgramIcon = (program: ProgramConfig) => {
    if (program.program_class === 'template') {
      return <Package style={{ color: theme.colors.info }} size={24} />;
    } else if (program.program_class === 'subscriber') {
      return <Users style={{ color: theme.colors.warning }} size={24} />;
    } else {
      return <FileCode style={{ color: theme.colors.primary }} size={24} />;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ 
            color: theme.colors.text,
            textShadow: theme.id === 'vault-tec' ? theme.effects.customEffects?.textGlow : 'none'
          }}>
            Program Configurations
          </h1>
          <p className="text-sm mt-2" style={{ color: theme.colors.textMuted }}>
            Manage program templates and subscriber implementations
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleImportFromYAML}
            disabled={importing}
            variant="secondary"
            icon={<Upload size={20} className={importing ? 'animate-spin' : ''} />}
            title="Import all YAML files from ship-agent/data/programs directory"
          >
            {importing ? 'Importing...' : 'Bulk Import'}
          </Button>
          <Button
            onClick={fetchPrograms}
            disabled={loading}
            variant="secondary"
            icon={<RefreshCw size={20} className={loading ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
          <Link to="/programs/new">
            <Button
              variant="primary"
              icon={<Plus size={20} />}
            >
              New Program
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div 
          className="mb-6 p-4 rounded-lg"
          style={{
            backgroundColor: `${theme.colors.danger}20`,
            border: `1px solid ${theme.colors.danger}`,
            color: theme.colors.danger,
          }}
        >
          {error}
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div 
          className="mb-6 p-4 rounded-lg"
          style={{
            backgroundColor: importResult.success ? `${theme.colors.success}20` : `${theme.colors.warning}20`,
            border: `1px solid ${importResult.success ? theme.colors.success : theme.colors.warning}`,
            color: importResult.success ? theme.colors.success : theme.colors.warning,
          }}
        >
          <div className="flex items-start gap-3">
            {importResult.success ? (
              <Check size={20} className="mt-0.5" />
            ) : (
              <AlertCircle size={20} className="mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-semibold mb-2">Import Complete</p>
              <div className="text-sm space-y-1">
                {importResult.summary.total === 1 ? (
                  <>
                    {importResult.summary.imported > 0 && (
                      <p>✅ Created new program: {importResult.details.imported[0]}</p>
                    )}
                    {importResult.summary.updated > 0 && (
                      <p>🔄 Updated existing program: {importResult.details.updated[0]}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p>Total files: {importResult.summary.total}</p>
                    <p>✅ Imported: {importResult.summary.imported}</p>
                    <p>🔄 Updated: {importResult.summary.updated}</p>
                    {importResult.summary.failed > 0 && (
                      <p>❌ Failed: {importResult.summary.failed}</p>
                    )}
                    {importResult.summary.skipped > 0 && (
                      <p>⚠️ Skipped: {importResult.summary.skipped}</p>
                    )}
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="text-sm hover:opacity-75"
              style={{ color: theme.colors.textMuted }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Import Help Text - only show if no programs */}
      {programs.length === 0 && !loading && (
        <div className="mb-4 p-3 rounded-lg flex items-start gap-3" style={{
          backgroundColor: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`
        }}>
          <AlertCircle size={16} style={{ color: theme.colors.info, marginTop: '2px' }} />
          <div className="text-sm" style={{ color: theme.colors.textSecondary }}>
            <strong style={{ color: theme.colors.text }}>Getting Started:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Use <strong>Bulk Import</strong> to import all YAML files from ship-agent/data/programs</li>
              <li>• Use <strong>Upload YAML</strong> below to import individual files</li>
              <li>• Or click <strong>New Program</strong> to create from scratch</li>
            </ul>
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{
        backgroundColor: theme.colors.surface
      }}>
        <button
          onClick={() => setViewMode('all')}
          className="px-4 py-2 rounded transition-colors"
          style={{
            backgroundColor: viewMode === 'all' ? theme.colors.primaryBackground : 'transparent',
            color: viewMode === 'all' ? theme.colors.primary : theme.colors.textMuted,
            transition: theme.effects.transition.base
          }}
        >
          All Programs ({programs.length})
        </button>
        <button
          onClick={() => setViewMode('templates')}
          className="px-4 py-2 rounded transition-colors flex items-center gap-2"
          style={{
            backgroundColor: viewMode === 'templates' ? `${theme.colors.info}20` : 'transparent',
            color: viewMode === 'templates' ? theme.colors.info : theme.colors.textMuted,
            transition: theme.effects.transition.base
          }}
        >
          <Package size={16} />
          <span>Templates ({programs.filter(p => p.program_class === 'template').length})</span>
        </button>
        <button
          onClick={() => setViewMode('subscribers')}
          className="px-4 py-2 rounded transition-colors flex items-center gap-2"
          style={{
            backgroundColor: viewMode === 'subscribers' ? `${theme.colors.warning}20` : 'transparent',
            color: viewMode === 'subscribers' ? theme.colors.warning : theme.colors.textMuted,
            transition: theme.effects.transition.base
          }}
        >
          <Users size={16} />
          <span>Subscribers ({programs.filter(p => p.program_class === 'subscriber').length})</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Search */}
        <VaultSearch
          placeholder="Search programs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Vendor Filter hidden - focusing on Highnote Inc. only */}

        {/* Status Filter */}
        <VaultSelect
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'draft', label: 'Draft' },
            { value: 'archived', label: 'Archived' }
          ]}
          placeholder="Select Status"
        />

        {/* Import YAML */}
        <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-pointer transition-all" style={{
          backgroundColor: theme.colors.surface,
          border: `2px solid ${theme.colors.border}`,
          color: theme.colors.textMuted,
          transition: theme.effects.transition.base
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = theme.colors.primary;
          e.currentTarget.style.borderColor = theme.colors.primaryBorder;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = theme.colors.textMuted;
          e.currentTarget.style.borderColor = theme.colors.border;
        }}>
          <Upload size={20} />
          <span>Upload YAML</span>
          <input 
            type="file" 
            accept=".yaml,.yml" 
            className="hidden" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = async (evt) => {
                  const content = evt.target?.result as string;
                  try {
                    setImporting(true);
                    const response = await api.programs.importYaml(content, file.name);
                    if (response.success) {
                      setImportResult({
                        success: true,
                        summary: {
                          total: 1,
                          imported: response.action === 'created' ? 1 : 0,
                          updated: response.action === 'updated' ? 1 : 0,
                          failed: 0,
                          skipped: 0
                        },
                        details: {
                          imported: response.action === 'created' ? [file.name] : [],
                          updated: response.action === 'updated' ? [file.name] : [],
                          failed: [],
                          skipped: []
                        }
                      });
                      await fetchPrograms();
                    }
                  } catch (err: any) {
                    console.error('Failed to import YAML:', err);
                    setError(err.message || 'Failed to import YAML file');
                  } finally {
                    setImporting(false);
                    // Reset the input so the same file can be selected again
                    e.target.value = '';
                  }
                };
                reader.readAsText(file);
              }
            }} 
          />
        </label>
      </div>

      {/* Programs Grid */}
      {loading && !error ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw 
            className="animate-spin" 
            size={32} 
            style={{ color: theme.colors.primary }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrograms.map((program) => (
            <Card
              key={program._id}
              variant="bordered"
              className="transition-all p-4 hover:shadow-lg"
              style={{
                borderColor: theme.colors.border
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primaryBorder;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  {getProgramIcon(program)}
                  {getStatusBadge(program.status)}
                </div>
                <div className="flex -mr-1">
                    <Link
                      to={`/programs/${program._id}`}
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
                      <Edit size={16} />
                    </Link>
                    <button
                      onClick={() => openCopyModal(program)}
                      className="p-2 rounded transition-all"
                      style={{ color: theme.colors.textMuted }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = theme.colors.info;
                        e.currentTarget.style.backgroundColor = theme.colors.secondaryBackground;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = theme.colors.textMuted;
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleExportYAML(program)}
                      className="p-2 rounded transition-all"
                      style={{ color: theme.colors.textMuted }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = theme.colors.warning;
                        e.currentTarget.style.backgroundColor = theme.colors.secondaryBackground;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = theme.colors.textMuted;
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Export YAML"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => openDeleteModal(program)}
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

              {/* Content */}
              <h3 className="font-semibold mb-1 text-base" style={{ color: theme.colors.text }}>
                {program.metadata?.name || 'Unnamed Program'}
              </h3>
              <p className="text-xs mb-3 line-clamp-2" style={{ color: theme.colors.textSecondary }}>
                {program.metadata?.description || 'No description available'}
              </p>

              {/* Compact Details Grid */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                <div style={{ color: theme.colors.textMuted }}>Type:</div>
                <div className="truncate" style={{ color: theme.colors.textSecondary }}>{program.program_type}</div>
                <div style={{ color: theme.colors.textMuted }}>Vendor:</div>
                <div className="truncate" style={{ color: theme.colors.textSecondary }}>{program.vendor}</div>
                <div style={{ color: theme.colors.textMuted }}>API:</div>
                <div className="uppercase" style={{ color: theme.colors.textSecondary }}>{program.api_type}</div>
                <div style={{ color: theme.colors.textMuted }}>Version:</div>
                <div style={{ color: theme.colors.textSecondary }}>{program.version}</div>
              </div>

              {/* Features */}
              {program.capabilities && program.capabilities.length > 0 && (
                <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <div className="flex flex-wrap gap-1">
                    {program.capabilities.slice(0, 2).map((cap, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 text-xs rounded"
                        style={{
                          backgroundColor: theme.colors.secondaryBackground,
                          color: theme.colors.textSecondary,
                          fontSize: '10px'
                        }}
                      >
                        {cap}
                      </span>
                    ))}
                    {program.capabilities.length > 2 && (
                      <span className="px-1.5 py-0.5 text-xs rounded" style={{
                        backgroundColor: theme.colors.secondaryBackground,
                        color: theme.colors.textMuted,
                        fontSize: '10px'
                      }}>
                        +{program.capabilities.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Compact Footer */}
              <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                <div className="flex items-center gap-3 text-xs">
                  {program.compliance?.standards?.some(s => s.name === 'PCI_DSS') && (
                    <div className="flex items-center gap-1" style={{ color: theme.colors.success }}>
                      <Shield size={14} />
                      <span>PCI</span>
                    </div>
                  )}
                  {program.integrations?.webhooks?.required && (
                    <div className="flex items-center gap-1" style={{ color: theme.colors.info }}>
                      <Zap size={14} />
                      <span>Webhooks</span>
                    </div>
                  )}
                </div>
                <Link
                  to={`/programs/${program._id}`}
                  className="text-xs flex items-center gap-1 transition-colors"
                  style={{ color: theme.colors.primary }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = theme.colors.primaryHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = theme.colors.primary;
                  }}
                >
                  <span>View Details</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && filteredPrograms.length === 0 && (
        <div className="text-center py-12">
          <FileCode 
            className="mx-auto mb-4 opacity-50" 
            size={48}
            style={{ color: theme.colors.textMuted }}
          />
          <p style={{ color: theme.colors.textMuted }}>No programs found</p>
          <Link to="/programs/new">
            <Button variant="primary" className="mt-4">
              Create First Program
            </Button>
          </Link>
        </div>
      )}

      {/* Copy Modal */}
      <InputModal
        isOpen={copyModalOpen}
        onClose={() => {
          setCopyModalOpen(false);
          setSelectedProgram(null);
        }}
        onSubmit={handleDuplicate}
        title="Duplicate Program"
        message={`Create a copy of "${selectedProgram?.metadata?.name || selectedProgram?.program_type}"`}
        placeholder="Enter name for the new program"
        defaultValue={`${selectedProgram?.metadata?.name || selectedProgram?.program_type}_copy`}
        submitText="Duplicate"
        cancelText="Cancel"
        validate={(value) => {
          if (!value.trim()) {
            return 'Program name is required';
          }
          if (value.length < 3) {
            return 'Program name must be at least 3 characters';
          }
          if (programs.some(p => p.metadata?.name === value)) {
            return 'A program with this name already exists';
          }
          return null;
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedProgram(null);
        }}
        onConfirm={handleDelete}
        title="Delete Program"
        message={`Are you sure you want to delete "${selectedProgram?.metadata?.name || selectedProgram?.program_type}"? This action cannot be undone.`}
        confirmText="Delete Program"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};