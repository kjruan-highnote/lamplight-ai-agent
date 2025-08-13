import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, Plus, Edit, Copy, Trash2, FileCode, 
  RefreshCw, Filter, Package, Users, Archive,
  ChevronRight, Download, Upload, Shield, Zap
} from 'lucide-react';
import { api } from '../lib/api';
import { ProgramConfig } from '../types';
import { useTheme } from '../themes/ThemeContext';
import { VaultSelect } from '../components/VaultSelect';
import { VaultSearch } from '../components/VaultInput';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';

export const ProgramsPage: React.FC = () => {
  const { theme } = useTheme();
  const [programs, setPrograms] = useState<ProgramConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'templates' | 'subscribers'>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

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
    
    const matchesVendor = 
      selectedVendor === 'all' || program.vendor === selectedVendor;
    
    const matchesStatus = 
      selectedStatus === 'all' || program.status === selectedStatus;
    
    return matchesSearch && matchesView && matchesVendor && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this program?')) {
      try {
        await api.programs.delete(id);
        await fetchPrograms();
      } catch (err) {
        console.error('Failed to delete program:', err);
        alert('Failed to delete program');
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    const program = programs.find(p => p._id === id);
    if (program) {
      const newName = prompt('Enter name for duplicated program:', `${program.metadata?.name}_copy`);
      if (newName) {
        try {
          await api.programs.duplicate(id, newName);
          await fetchPrograms();
        } catch (err) {
          console.error('Failed to duplicate program:', err);
          alert('Failed to duplicate program');
        }
      }
    }
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

        {/* Vendor Filter */}
        <VaultSelect
          value={selectedVendor}
          onChange={setSelectedVendor}
          options={[
            { value: 'all', label: 'All Vendors' },
            ...vendors.map(vendor => ({ value: vendor, label: vendor }))
          ]}
          placeholder="Select Vendor"
        />

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
          <span>Import YAML</span>
          <input type="file" accept=".yaml,.yml" className="hidden" onChange={() => {}} />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredPrograms.map((program) => (
            <Card
              key={program._id}
              variant="bordered"
              className="transition-all p-6"
              style={{
                borderColor: theme.colors.border
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.colors.primaryBorder;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                {getProgramIcon(program)}
                <div className="flex items-center space-x-2">
                  {getStatusBadge(program.status)}
                  <div className="flex space-x-1">
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
                      onClick={() => handleDuplicate(program._id!)}
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
                      onClick={() => handleDelete(program._id!)}
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
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                {program.metadata?.name || 'Unnamed Program'}
              </h3>
              <p className="text-sm mb-4 line-clamp-2" style={{ color: theme.colors.textSecondary }}>
                {program.metadata?.description || 'No description available'}
              </p>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>Type:</span>
                  <span style={{ color: theme.colors.textSecondary }}>{program.program_type}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>Vendor:</span>
                  <span style={{ color: theme.colors.textSecondary }}>{program.vendor}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>API:</span>
                  <span className="uppercase" style={{ color: theme.colors.textSecondary }}>{program.api_type}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.colors.textMuted }}>Version:</span>
                  <span style={{ color: theme.colors.textSecondary }}>{program.version}</span>
                </div>
              </div>

              {/* Features */}
              {program.capabilities && program.capabilities.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <div className="flex flex-wrap gap-2">
                    {program.capabilities.slice(0, 3).map((cap, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs rounded"
                        style={{
                          backgroundColor: theme.colors.secondaryBackground,
                          color: theme.colors.textSecondary
                        }}
                      >
                        {cap}
                      </span>
                    ))}
                    {program.capabilities.length > 3 && (
                      <span className="px-2 py-1 text-xs rounded" style={{
                        backgroundColor: theme.colors.secondaryBackground,
                        color: theme.colors.textMuted
                      }}>
                        +{program.capabilities.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Compliance Indicators */}
              <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
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
    </div>
  );
};