import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Save, Eye, FileCode, AlertCircle, Check, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { ProgramConfig, Category, Operation } from '../types';
import * as yaml from 'js-yaml';

export const ProgramEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState<ProgramConfig>({
    program_type: '',
    name: '',
    version: '1.0.0',
    vendor: 'Highnote Inc.',
    api_type: 'graphql',
    config: {
      metadata: {
        name: '',
        description: '',
        base_url: '{{apiUrl}}',
        authentication: {
          type: 'Basic <BASE64_ENCODED_API_KEY>',
          header: 'Authorization',
        },
      },
      capabilities: [],
      workflows: {},
      entities: [],
      categories: [],
    },
    tags: [],
  });
  
  const [yamlContent, setYamlContent] = useState('');
  const [viewMode, setViewMode] = useState<'form' | 'yaml'>('form');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (id && id !== 'new') {
      loadProgram();
    } else {
      updateYamlContent();
    }
  }, [id]);

  const loadProgram = async () => {
    try {
      const data = await api.programs.get(id!);
      setProgram(data);
      updateYamlContent(data);
    } catch (err) {
      setError('Failed to load program');
    }
  };

  const updateYamlContent = (programData = program) => {
    try {
      const yamlStr = yaml.dump(programData.config, { 
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });
      setYamlContent(yamlStr);
    } catch (err) {
      console.error('Failed to convert to YAML:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // If in YAML mode, parse and update program config
      if (viewMode === 'yaml') {
        try {
          const parsedConfig = yaml.load(yamlContent) as any;
          program.config = parsedConfig;
        } catch (e) {
          setError('Invalid YAML format');
          setSaving(false);
          return;
        }
      }

      if (id && id !== 'new') {
        await api.programs.update(id, program);
        setSuccess('Program updated successfully');
      } else {
        const result = await api.programs.create(program);
        setSuccess('Program created successfully');
        navigate(`/programs/${result._id}`, { replace: true });
      }
    } catch (err) {
      setError('Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setProgram(prev => {
      const updated = { ...prev };
      const keys = field.split('.');
      let current: any = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      updateYamlContent(updated);
      return updated;
    });
  };

  const addCategory = () => {
    const newCategory: Category = {
      name: `category_${program.config.categories.length + 1}`,
      display_name: `Category ${program.config.categories.length + 1}`,
      description: '',
      order: program.config.categories.length + 1,
      operations: [],
    };
    
    handleFormChange('config.categories', [...program.config.categories, newCategory]);
  };

  const removeCategory = (index: number) => {
    const updated = program.config.categories.filter((_, i) => i !== index);
    handleFormChange('config.categories', updated);
  };

  const addOperation = (categoryIndex: number) => {
    const newOperation: Operation = {
      name: 'NewOperation',
      type: 'query',
      required: false,
    };
    
    const updated = [...program.config.categories];
    updated[categoryIndex].operations.push(newOperation);
    handleFormChange('config.categories', updated);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 border-2 border-vault-green/50 bg-vault-terminal p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-terminal text-vault-green animate-flicker">
              ▶ {id === 'new' ? 'NEW PROGRAM' : 'EDIT PROGRAM'}
            </h1>
            {program.name && (
              <div className="text-xs text-vault-green/50 mt-1">{program.name}</div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setViewMode(viewMode === 'form' ? 'yaml' : 'form')}
              className="vault-button px-4 py-2 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-sm hover:bg-vault-green/20 hover:border-vault-green transition-all flex items-center space-x-2"
            >
              {viewMode === 'form' ? <FileCode size={16} /> : <Eye size={16} />}
              <span>{viewMode === 'form' ? 'YAML' : 'FORM'}</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="vault-button px-6 py-2 bg-vault-green/20 border border-vault-green text-vault-green font-mono text-sm hover:bg-vault-green/30 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              <Save size={16} />
              <span>{saving ? 'SAVING...' : 'SAVE'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 text-red-400 flex items-center space-x-2">
          <AlertCircle size={16} />
          <span className="text-sm font-mono">{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-vault-green/10 border border-vault-green/50 text-vault-green flex items-center space-x-2">
          <Check size={16} />
          <span className="text-sm font-mono">{success}</span>
        </div>
      )}

      {/* Editor Content */}
      <div className="border-2 border-vault-green/30 bg-vault-surface">
        {viewMode === 'form' ? (
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-vault-green/50 mb-2 font-terminal">PROGRAM TYPE</label>
                <input
                  type="text"
                  value={program.program_type}
                  onChange={(e) => handleFormChange('program_type', e.target.value)}
                  placeholder="e.g., ap_automation"
                  className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                />
              </div>
              <div>
                <label className="block text-xs text-vault-green/50 mb-2 font-terminal">PROGRAM NAME</label>
                <input
                  type="text"
                  value={program.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g., AP Automation"
                  className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                />
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-4">
              <div className="text-xs text-vault-green/50 font-terminal">═══ METADATA ═══</div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-vault-green/50 mb-2">DISPLAY NAME</label>
                  <input
                    type="text"
                    value={program.config.metadata.name}
                    onChange={(e) => handleFormChange('config.metadata.name', e.target.value)}
                    className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                  />
                </div>
                <div>
                  <label className="block text-xs text-vault-green/50 mb-2">API TYPE</label>
                  <select
                    value={program.api_type}
                    onChange={(e) => handleFormChange('api_type', e.target.value)}
                    className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                  >
                    <option value="graphql">GraphQL</option>
                    <option value="rest">REST</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-vault-green/50 mb-2">DESCRIPTION</label>
                <textarea
                  value={program.config.metadata.description}
                  onChange={(e) => handleFormChange('config.metadata.description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-vault-terminal border border-vault-green/30 text-vault-green font-mono text-sm focus:outline-none focus:border-vault-green"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-vault-green/50 font-terminal">═══ OPERATION CATEGORIES ═══</div>
                <button
                  onClick={addCategory}
                  className="vault-button px-3 py-1 bg-vault-surface border border-vault-green/50 text-vault-green font-mono text-xs hover:bg-vault-green/20 hover:border-vault-green transition-all flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>ADD CATEGORY</span>
                </button>
              </div>

              {program.config.categories.map((category, catIndex) => (
                <div key={catIndex} className="p-4 bg-vault-terminal border border-vault-green/30">
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      value={category.display_name}
                      onChange={(e) => {
                        const updated = [...program.config.categories];
                        updated[catIndex].display_name = e.target.value;
                        handleFormChange('config.categories', updated);
                      }}
                      className="text-sm font-mono text-vault-green bg-transparent border-b border-vault-green/30 focus:outline-none focus:border-vault-green"
                    />
                    <button
                      onClick={() => removeCategory(catIndex)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs text-vault-green/50">Operations: {category.operations.length}</div>
                    <button
                      onClick={() => addOperation(catIndex)}
                      className="text-xs text-vault-green/70 hover:text-vault-green"
                    >
                      [+] Add Operation
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Note */}
            <div className="p-4 bg-vault-terminal border border-vault-green/30">
              <p className="text-xs text-vault-green/70 font-mono">
                ▶ Switch to YAML mode for full configuration editing including workflows, entities, and compliance settings
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[600px]">
            <Editor
              height="100%"
              defaultLanguage="yaml"
              value={yamlContent}
              onChange={(value) => setYamlContent(value || '')}
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
      </div>
    </div>
  );
};