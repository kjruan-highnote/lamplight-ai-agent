import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, AlertCircle, HelpCircle } from 'lucide-react';
import { useTheme } from '../../themes/ThemeContext';
import { OperationVariable } from '../../types';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

interface VariableManagerProps {
  variables: Record<string, OperationVariable>;
  onChange: (variables: Record<string, OperationVariable>) => void;
  graphqlQuery?: string;
}

// Common GraphQL types
const GRAPHQL_TYPES = [
  'String',
  'Int',
  'Float',
  'Boolean',
  'ID',
  'String!',
  'Int!',
  'Float!',
  'Boolean!',
  'ID!',
  '[String]',
  '[Int]',
  '[ID]',
  '[String!]!',
  '[Int!]!',
  '[ID!]!',
];

export const VariableManager: React.FC<VariableManagerProps> = ({
  variables,
  onChange,
  graphqlQuery = ''
}) => {
  const { theme } = useTheme();
  const [editingVariable, setEditingVariable] = useState<string | null>(null);
  const [newVariable, setNewVariable] = useState<Partial<OperationVariable>>({
    name: '',
    type: 'String',
    required: false,
    description: ''
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [detectedVariables, setDetectedVariables] = useState<Record<string, OperationVariable>>({});
  const [showAutoDetect, setShowAutoDetect] = useState(false);

  // Auto-detect variables from GraphQL query
  useEffect(() => {
    if (graphqlQuery) {
      const detected = parseVariablesFromQuery(graphqlQuery);
      setDetectedVariables(detected);
      
      // Check if there are new variables to suggest
      const hasNewVariables = Object.keys(detected).some(key => !variables[key]);
      setShowAutoDetect(hasNewVariables);
    }
  }, [graphqlQuery]);

  // Parse variables from GraphQL query
  const parseVariablesFromQuery = (query: string): Record<string, OperationVariable> => {
    const variables: Record<string, OperationVariable> = {};
    
    // Match variable declarations like ($id: ID!, $name: String)
    const varRegex = /\$(\w+):\s*([^,\)]+)/g;
    let match;
    
    while ((match = varRegex.exec(query)) !== null) {
      const [, name, typeStr] = match;
      const required = typeStr.includes('!');
      const type = typeStr.trim();
      
      variables[name] = {
        name,
        type,
        required: type.endsWith('!'),
        description: `Variable ${name} of type ${type}`
      };
    }
    
    return variables;
  };

  const handleAddVariable = () => {
    if (!newVariable.name) return;
    
    const variableName = newVariable.name.startsWith('$') 
      ? newVariable.name.substring(1) 
      : newVariable.name;
    
    onChange({
      ...variables,
      [variableName]: {
        name: variableName,
        type: newVariable.type || 'String',
        required: newVariable.required || false,
        description: newVariable.description || ''
      }
    });
    
    setNewVariable({
      name: '',
      type: 'String',
      required: false,
      description: ''
    });
    setShowNewForm(false);
  };

  const handleUpdateVariable = (key: string, updates: Partial<OperationVariable>) => {
    onChange({
      ...variables,
      [key]: {
        ...variables[key],
        ...updates
      }
    });
    setEditingVariable(null);
  };

  const handleDeleteVariable = (key: string) => {
    const newVariables = { ...variables };
    delete newVariables[key];
    onChange(newVariables);
  };

  const handleAutoDetect = () => {
    // Merge detected variables with existing ones
    const merged = { ...variables };
    
    Object.entries(detectedVariables).forEach(([key, variable]) => {
      if (!merged[key]) {
        merged[key] = variable;
      }
    });
    
    onChange(merged);
    setShowAutoDetect(false);
  };

  const getTypeColor = (type: string) => {
    if (type.includes('!')) return theme.colors.danger;
    if (type.includes('[')) return theme.colors.info;
    if (type === 'ID') return theme.colors.warning;
    if (type === 'Boolean') return theme.colors.success;
    return theme.colors.primary;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold" style={{ color: theme.colors.text }}>
            Variables
          </h4>
          <span className="text-xs px-2 py-0.5 rounded" style={{
            backgroundColor: theme.colors.secondaryBackground,
            color: theme.colors.textSecondary
          }}>
            {Object.keys(variables).length} defined
          </span>
        </div>
        
        <div className="flex gap-2">
          {showAutoDetect && (
            <Button
              variant="secondary"
              size="sm"
              icon={<AlertCircle size={14} />}
              onClick={handleAutoDetect}
            >
              Auto-detect from Query
            </Button>
          )}
          
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowNewForm(true)}
          >
            Add Variable
          </Button>
        </div>
      </div>

      {/* Auto-detect notification */}
      {showAutoDetect && Object.keys(detectedVariables).length > 0 && (
        <div 
          className="p-3 rounded-lg flex items-start gap-2"
          style={{
            backgroundColor: `${theme.colors.info}20`,
            border: `1px solid ${theme.colors.info}40`
          }}
        >
          <AlertCircle size={16} style={{ color: theme.colors.info, marginTop: 2 }} />
          <div className="flex-1">
            <p className="text-sm" style={{ color: theme.colors.text }}>
              Found {Object.keys(detectedVariables).length} variables in your GraphQL query
            </p>
            <p className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
              Click "Auto-detect from Query" to add them automatically
            </p>
          </div>
        </div>
      )}

      {/* New Variable Form */}
      {showNewForm && (
        <div 
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }}
        >
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.textMuted }}>
                Name
              </label>
              <Input
                value={newVariable.name || ''}
                onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                placeholder="$variableName"
                className="font-mono text-sm"
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.textMuted }}>
                Type
              </label>
              <Select
                value={newVariable.type || 'String'}
                onChange={(value) => setNewVariable({ ...newVariable, type: value })}
                options={GRAPHQL_TYPES.map(t => ({ value: t, label: t }))}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: theme.colors.textMuted }}>
                Description
              </label>
              <Input
                value={newVariable.description || ''}
                onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                placeholder="Variable description"
              />
            </div>
            
            <div className="flex items-end gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddVariable}
                disabled={!newVariable.name}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowNewForm(false);
                  setNewVariable({
                    name: '',
                    type: 'String',
                    required: false,
                    description: ''
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Variables List */}
      <div className="space-y-2">
        {Object.entries(variables).length === 0 ? (
          <div 
            className="p-6 text-center rounded-lg border-2 border-dashed"
            style={{
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.background
            }}
          >
            <HelpCircle size={32} className="mx-auto mb-2 opacity-50" style={{ color: theme.colors.textMuted }} />
            <p className="text-sm" style={{ color: theme.colors.textMuted }}>
              No variables defined
            </p>
            <p className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
              Add variables that your GraphQL query accepts
            </p>
          </div>
        ) : (
          Object.entries(variables).map(([key, variable]) => {
            const isEditing = editingVariable === key;
            
            return (
              <div
                key={key}
                className="flex items-center gap-3 p-3 rounded-lg transition-all"
                style={{
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${isEditing ? theme.colors.primaryBorder : theme.colors.border}`
                }}
              >
                {/* Variable Name */}
                <div className="flex items-center gap-2 min-w-[150px]">
                  <span 
                    className="font-mono text-sm font-semibold"
                    style={{ color: theme.colors.primary }}
                  >
                    ${isEditing ? (
                      <Input
                        value={variable.name}
                        onChange={(e) => handleUpdateVariable(key, { name: e.target.value })}
                        className="inline-block w-24"
                      />
                    ) : variable.name}
                  </span>
                </div>

                {/* Type */}
                <div className="flex items-center gap-2 min-w-[120px]">
                  {isEditing ? (
                    <Select
                      value={variable.type}
                      onChange={(value) => handleUpdateVariable(key, { type: value })}
                      options={GRAPHQL_TYPES.map(t => ({ value: t, label: t }))}
                    />
                  ) : (
                    <span 
                      className="px-2 py-1 text-xs font-mono rounded"
                      style={{
                        backgroundColor: `${getTypeColor(variable.type)}20`,
                        color: getTypeColor(variable.type)
                      }}
                    >
                      {variable.type}
                    </span>
                  )}
                </div>

                {/* Required Badge */}
                {variable.required && !isEditing && (
                  <span 
                    className="px-2 py-0.5 text-xs rounded"
                    style={{
                      backgroundColor: `${theme.colors.warning}20`,
                      color: theme.colors.warning
                    }}
                  >
                    Required
                  </span>
                )}

                {/* Description */}
                <div className="flex-1">
                  {isEditing ? (
                    <Input
                      value={variable.description || ''}
                      onChange={(e) => handleUpdateVariable(key, { description: e.target.value })}
                      placeholder="Variable description"
                    />
                  ) : (
                    <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      {variable.description || 'No description'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setEditingVariable(null)}
                        className="p-1.5 rounded transition-all"
                        style={{ color: theme.colors.success }}
                        title="Save"
                      >
                        <Save size={14} />
                      </button>
                      <button
                        onClick={() => setEditingVariable(null)}
                        className="p-1.5 rounded transition-all"
                        style={{ color: theme.colors.textMuted }}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingVariable(key)}
                        className="p-1.5 rounded transition-all"
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
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteVariable(key)}
                        className="p-1.5 rounded transition-all"
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
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Help Text */}
      <div 
        className="p-3 rounded-lg text-xs"
        style={{
          backgroundColor: theme.colors.background,
          color: theme.colors.textMuted
        }}
      >
        <div className="flex items-start gap-2">
          <HelpCircle size={14} style={{ marginTop: 1 }} />
          <div>
            <p>Variables define the inputs your GraphQL operation accepts.</p>
            <p className="mt-1">
              Use <code className="px-1 py-0.5 rounded" style={{ backgroundColor: theme.colors.surface }}>!</code> suffix for required types (e.g., String!)
            </p>
            <p className="mt-1">
              Use <code className="px-1 py-0.5 rounded" style={{ backgroundColor: theme.colors.surface }}>[]</code> for arrays (e.g., [String], [ID!]!)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};