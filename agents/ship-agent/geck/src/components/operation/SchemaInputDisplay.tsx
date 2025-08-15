import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info, List, Code } from 'lucide-react';
import { OperationVariable } from '../../types';
import { VaultButton } from '../VaultButton';

interface SchemaInputDisplayProps {
  inputs: Record<string, OperationVariable>;
  title?: string;
}

export const SchemaInputDisplay: React.FC<SchemaInputDisplayProps> = ({ 
  inputs, 
  title = "Input Parameters" 
}) => {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'json'>('tree');
  
  // Debug logging
  console.log('SchemaInputDisplay received inputs:', inputs);
  
  // Handle the case where inputs is { input: { fields... } }
  // This happens when the data comes from the enrich-by-types endpoint
  let actualInputs: Record<string, OperationVariable> = inputs;
  if (inputs && inputs.input && typeof inputs.input === 'object' && 
      !('name' in inputs.input) && !('type' in inputs.input)) {
    // If 'input' is the only key and it contains field definitions, use those
    actualInputs = inputs.input as any;
    console.log('Using nested input structure:', actualInputs);
  } else {
    console.log('Using direct input structure:', actualInputs);
  }

  const toggleExpanded = (fieldPath: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldPath)) {
      newExpanded.delete(fieldPath);
    } else {
      newExpanded.add(fieldPath);
    }
    setExpandedFields(newExpanded);
  };

  const getTypeColor = (type: string) => {
    const typeMap: Record<string, string> = {
      'String': 'text-green-400',
      'Int': 'text-blue-400',
      'Float': 'text-blue-400',
      'Boolean': 'text-yellow-400',
      'ID': 'text-purple-400',
      'DateTime': 'text-orange-400',
      'Date': 'text-orange-400',
      'JSON': 'text-pink-400',
    };
    
    // Check if it's a custom type (starts with uppercase)
    if (type && type[0] === type[0].toUpperCase() && !typeMap[type]) {
      return 'text-cyan-400';
    }
    
    return typeMap[type] || 'text-gray-400';
  };

  const renderVariable = (variable: OperationVariable, path: string = '', depth: number = 0) => {
    // Ensure variable has the correct structure
    const varName = typeof variable.name === 'string' ? variable.name : 'unknown';
    const varType = typeof variable.type === 'string' ? variable.type : 'Object';
    
    const fullPath = path ? `${path}.${varName}` : varName;
    const hasFields = variable.fields && Object.keys(variable.fields).length > 0;
    const isExpanded = expandedFields.has(fullPath);
    
    return (
      <div key={fullPath} className={`${depth > 0 ? 'ml-6' : ''}`}>
        <div className="flex items-start py-2 border-b border-gray-700 hover:bg-gray-800/30 transition-colors">
          <div className="flex items-center flex-1">
            {hasFields && (
              <button
                onClick={() => toggleExpanded(fullPath)}
                className="mr-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            {!hasFields && <div className="w-6" />}
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">
                  {varName}
                  {variable.required && <span className="text-red-400 ml-1">*</span>}
                </span>
                
                <span className={`font-mono text-xs ${getTypeColor(varType)}`}>
                  {variable.isList ? `[${varType}]` : varType}
                </span>
                
                {variable.defaultValue !== undefined && (
                  <span className="text-xs text-gray-500">
                    = {JSON.stringify(variable.defaultValue)}
                  </span>
                )}
              </div>
              
              {variable.description && (
                <div className="flex items-start gap-1 mt-1">
                  <Info size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-400">{variable.description}</p>
                </div>
              )}
              
              {variable.enumValues && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">Enum: </span>
                  <span className="text-xs text-cyan-400 font-mono">
                    {variable.enumValues.join(' | ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {hasFields && isExpanded && (
          <div className="mt-1">
            {Object.values(variable.fields!).map(field => 
              renderVariable(field, fullPath, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderJsonView = () => {
    const buildJsonStructure = (vars: Record<string, OperationVariable>): any => {
      const result: any = {};
      
      Object.entries(vars).forEach(([key, variable]) => {
        if (variable.fields) {
          result[key] = buildJsonStructure(variable.fields);
        } else if (variable.isList) {
          result[key] = [`<${variable.type}>`];
        } else {
          result[key] = `<${variable.type}${variable.required ? '!' : '?'}>`;
        }
      });
      
      return result;
    };
    
    const jsonStructure = buildJsonStructure(actualInputs);
    
    return (
      <pre className="bg-gray-900 p-4 rounded-lg overflow-auto text-xs font-mono">
        <code className="text-green-400">
          {JSON.stringify(jsonStructure, null, 2)}
        </code>
      </pre>
    );
  };

  if (!inputs || Object.keys(inputs).length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">
        No input parameters defined
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Code size={20} />
          {title}
        </h3>
        
        <div className="flex gap-2">
          <VaultButton
            variant={viewMode === 'tree' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('tree')}
          >
            <List size={16} />
          </VaultButton>
          <VaultButton
            variant={viewMode === 'json' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('json')}
          >
            <Code size={16} />
          </VaultButton>
        </div>
      </div>
      
      {viewMode === 'tree' ? (
        <div className="border border-gray-700 rounded-lg bg-gray-800/50">
          <div className="p-4">
            {Object.entries(actualInputs).map(([key, variable]) => {
              // Ensure variable is an OperationVariable, not just any object
              if (typeof variable === 'object' && variable !== null && 
                  (variable.name || variable.type)) {
                return renderVariable(variable as OperationVariable);
              }
              return null;
            }).filter(Boolean)}
          </div>
        </div>
      ) : (
        renderJsonView()
      )}
    </div>
  );
};