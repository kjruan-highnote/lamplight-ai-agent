import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, Plus, Edit, Copy, Trash2, FileCode, 
  RefreshCw, Filter, Package, Users, Archive,
  ChevronRight, Download, Upload, Shield, Zap
} from 'lucide-react';
import { api } from '../lib/api';
import { ProgramConfig } from '../types';
import { VaultSelect } from '../components/VaultSelect';
import { VaultSearch } from '../components/VaultInput';

export const ProgramsPage: React.FC = () => {
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
        return <span className="px-2 py-1 text-xs bg-vault-green/20 text-vault-green rounded">ACTIVE</span>;
      case 'draft':
        return <span className="px-2 py-1 text-xs bg-vault-amber/20 text-vault-amber rounded">DRAFT</span>;
      case 'archived':
        return <span className="px-2 py-1 text-xs bg-gray-700 text-gray-400 rounded">ARCHIVED</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-700 text-gray-400 rounded">UNKNOWN</span>;
    }
  };

  const getProgramIcon = (program: ProgramConfig) => {
    if (program.program_class === 'template') {
      return <Package className="text-vault-blue" size={24} />;
    } else if (program.program_class === 'subscriber') {
      return <Users className="text-vault-amber" size={24} />;
    } else {
      return <FileCode className="text-vault-green" size={24} />;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-vault-green terminal-glow">
            Program Configurations
          </h1>
          <p className="text-sm text-vault-green/50 mt-2">
            Manage program templates and subscriber implementations
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={fetchPrograms}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-3 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <Link
            to="/programs/new"
            className="flex items-center space-x-2 px-6 py-3 bg-vault-green/20 text-vault-green border border-vault-green/50 rounded-lg hover:bg-vault-green/30 transition-colors"
          >
            <Plus size={20} />
            <span>New Program</span>
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-900 p-1 rounded-lg w-fit">
        <button
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 rounded transition-colors ${
            viewMode === 'all'
              ? 'bg-vault-green/20 text-vault-green'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          All Programs ({programs.length})
        </button>
        <button
          onClick={() => setViewMode('templates')}
          className={`px-4 py-2 rounded transition-colors flex items-center space-x-2 ${
            viewMode === 'templates'
              ? 'bg-vault-blue/20 text-vault-blue'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Package size={16} />
          <span>Templates ({programs.filter(p => p.program_class === 'template').length})</span>
        </button>
        <button
          onClick={() => setViewMode('subscribers')}
          className={`px-4 py-2 rounded transition-colors flex items-center space-x-2 ${
            viewMode === 'subscribers'
              ? 'bg-vault-amber/20 text-vault-amber'
              : 'text-gray-400 hover:text-gray-200'
          }`}
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
        <label className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-vault-green hover:border-vault-green/50 cursor-pointer transition-colors">
          <Upload size={20} />
          <span>Import YAML</span>
          <input type="file" accept=".yaml,.yml" className="hidden" onChange={() => {}} />
        </label>
      </div>

      {/* Programs Grid */}
      {loading && !error ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-vault-green" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredPrograms.map((program) => (
            <div
              key={program._id}
              className="bg-gray-900 rounded-lg border border-gray-800 hover:border-vault-green/50 transition-all p-6"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                {getProgramIcon(program)}
                <div className="flex items-center space-x-2">
                  {getStatusBadge(program.status)}
                  <div className="flex space-x-1">
                    <Link
                      to={`/programs/${program._id}`}
                      className="p-2 text-gray-400 hover:text-vault-green transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </Link>
                    <button
                      onClick={() => handleDuplicate(program._id!)}
                      className="p-2 text-gray-400 hover:text-vault-blue transition-colors"
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleExportYAML(program)}
                      className="p-2 text-gray-400 hover:text-vault-amber transition-colors"
                      title="Export YAML"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(program._id!)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold mb-2">{program.metadata?.name || 'Unnamed Program'}</h3>
              <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                {program.metadata?.description || 'No description available'}
              </p>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span className="text-gray-300">{program.program_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vendor:</span>
                  <span className="text-gray-300">{program.vendor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">API:</span>
                  <span className="text-gray-300 uppercase">{program.api_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Version:</span>
                  <span className="text-gray-300">{program.version}</span>
                </div>
              </div>

              {/* Features */}
              {program.capabilities && program.capabilities.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="flex flex-wrap gap-2">
                    {program.capabilities.slice(0, 3).map((cap, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded"
                      >
                        {cap}
                      </span>
                    ))}
                    {program.capabilities.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-gray-800 text-gray-500 rounded">
                        +{program.capabilities.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Compliance Indicators */}
              <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                <div className="flex items-center space-x-3 text-xs">
                  {program.compliance?.standards?.some(s => s.name === 'PCI_DSS') && (
                    <div className="flex items-center space-x-1 text-vault-green">
                      <Shield size={14} />
                      <span>PCI</span>
                    </div>
                  )}
                  {program.integrations?.webhooks?.required && (
                    <div className="flex items-center space-x-1 text-vault-blue">
                      <Zap size={14} />
                      <span>Webhooks</span>
                    </div>
                  )}
                </div>
                <Link
                  to={`/programs/${program._id}`}
                  className="text-xs text-vault-green hover:text-vault-green/80 flex items-center space-x-1"
                >
                  <span>View Details</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredPrograms.length === 0 && (
        <div className="text-center py-12">
          <FileCode className="mx-auto text-gray-700 mb-4" size={48} />
          <p className="text-gray-500">No programs found</p>
          <Link
            to="/programs/new"
            className="inline-flex items-center space-x-2 mt-4 px-4 py-2 bg-vault-green/20 text-vault-green border border-vault-green/50 rounded-lg hover:bg-vault-green/30 transition-colors"
          >
            <Plus size={16} />
            <span>Create First Program</span>
          </Link>
        </div>
      )}
    </div>
  );
};