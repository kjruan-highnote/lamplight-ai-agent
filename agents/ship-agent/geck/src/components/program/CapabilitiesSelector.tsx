import React, { useState, useEffect } from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { 
  CAPABILITIES, 
  CAPABILITY_CATEGORIES,
  getWorkflowsForCapabilities,
  getCapabilityDependencies,
  getEntitiesForCapabilities,
  Capability 
} from '../../config/capabilities';
import { 
  DollarSign, Shield, Lock, Eye, Settings, 
  Check, AlertCircle, Info, ChevronRight,
  Zap, Database, GitBranch
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

interface CapabilitiesSelectorProps {
  selectedCapabilities: string[];
  onChange: (capabilities: string[]) => void;
  onWorkflowsGenerated?: (workflows: any[]) => void;
  customCapabilities?: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    isCustom?: boolean;
    requiredWorkflows?: string[];
    suggestedWorkflows?: string[];
    requiredEntities?: string[];
    dependencies?: string[];
  }>;
}

export const CapabilitiesSelector: React.FC<CapabilitiesSelectorProps> = ({
  selectedCapabilities,
  onChange,
  onWorkflowsGenerated,
  customCapabilities = []
}) => {
  const { theme } = useTheme();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [suggestedWorkflows, setSuggestedWorkflows] = useState<any[]>([]);
  const [requiredEntities, setRequiredEntities] = useState<string[]>([]);

  // Merge standard and custom capabilities
  const allCapabilities: Record<string, Capability> = {
    ...CAPABILITIES,
    ...customCapabilities.reduce((acc, cap) => ({
      ...acc,
      [cap.id]: cap as Capability
    }), {} as Record<string, Capability>)
  };

  // Update derived data when capabilities change
  useEffect(() => {
    const deps = getCapabilityDependencies(selectedCapabilities);
    const workflows = getWorkflowsForCapabilities(selectedCapabilities);
    const entities = getEntitiesForCapabilities(selectedCapabilities);
    
    setDependencies(deps);
    setSuggestedWorkflows(workflows);
    setRequiredEntities(entities);
    
    if (onWorkflowsGenerated) {
      onWorkflowsGenerated(workflows);
    }
  }, [selectedCapabilities, onWorkflowsGenerated]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'funding': return <DollarSign size={20} />;
      case 'authorization': return <Shield size={20} />;
      case 'controls': return <Lock size={20} />;
      case 'monitoring': return <Eye size={20} />;
      case 'management': return <Settings size={20} />;
      default: return <Zap size={20} />;
    }
  };

  const toggleCapability = (capabilityId: string) => {
    if (selectedCapabilities.includes(capabilityId)) {
      onChange(selectedCapabilities.filter(id => id !== capabilityId));
    } else {
      // Check for dependencies
      const capability = allCapabilities[capabilityId];
      const newCapabilities = [...selectedCapabilities, capabilityId];
      
      // Auto-add dependencies
      if (capability?.dependencies) {
        capability.dependencies.forEach(dep => {
          if (!newCapabilities.includes(dep)) {
            newCapabilities.push(dep);
          }
        });
      }
      
      onChange(newCapabilities);
    }
  };

  const renderCapabilityCard = (capability: Capability) => {
    const isSelected = selectedCapabilities.includes(capability.id);
    const hasDependencies = capability.dependencies && capability.dependencies.length > 0;
    const missingDeps = capability.dependencies?.filter(dep => !selectedCapabilities.includes(dep)) || [];
    
    return (
      <div
        key={capability.id}
        className="p-4 rounded-lg border-2 transition-all cursor-pointer"
        style={{
          backgroundColor: isSelected ? theme.colors.primaryBackground : theme.colors.surface,
          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
          borderStyle: 'solid'
        }}
        onClick={() => toggleCapability(capability.id)}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = theme.colors.primaryBorder;
            e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.borderColor = theme.colors.border;
            e.currentTarget.style.backgroundColor = theme.colors.surface;
          }
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold" style={{ color: theme.colors.text }}>
            {capability.name}
          </h4>
          <div className="flex items-center gap-2">
            {hasDependencies && missingDeps.length > 0 && (
              <span title="Has dependencies">
                <AlertCircle size={16} style={{ color: theme.colors.warning }} />
              </span>
            )}
            {isSelected && (
              <Check size={20} style={{ color: theme.colors.primary }} />
            )}
          </div>
        </div>
        
        <p className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
          {capability.description}
        </p>
        
        {hasDependencies && (
          <div className="text-xs" style={{ color: theme.colors.textMuted }}>
            {missingDeps.length > 0 ? (
              <span>Requires: {missingDeps.join(', ')}</span>
            ) : (
              <span>Dependencies met ✓</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Capabilities by Category */}
      <div className="space-y-4">
        {[...Object.entries({...CAPABILITY_CATEGORIES, custom: { name: 'Custom', description: 'Custom capabilities for your program', icon: 'Settings' }})].map(([categoryId, category]) => {
          const categoryCapabilities = Object.values(allCapabilities).filter(
            cap => cap.category === categoryId
          );
          
          // Skip empty categories
          if (categoryCapabilities.length === 0) return null;
          const isExpanded = expandedCategory === categoryId;
          const selectedCount = categoryCapabilities.filter(
            cap => selectedCapabilities.includes(cap.id)
          ).length;
          
          return (
            <Card key={categoryId} variant="bordered">
              <div
                className="p-4 cursor-pointer flex items-center justify-between"
                style={{ backgroundColor: theme.colors.surface }}
                onClick={() => setExpandedCategory(isExpanded ? null : categoryId)}
              >
                <div className="flex items-center gap-3">
                  {getCategoryIcon(categoryId)}
                  <div>
                    <h3 className="font-semibold" style={{ color: theme.colors.text }}>
                      {category.name}
                    </h3>
                    <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                      {category.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {selectedCount > 0 && (
                    <span className="px-2 py-1 text-xs rounded" style={{
                      backgroundColor: theme.colors.primaryBackground,
                      color: theme.colors.primary
                    }}>
                      {selectedCount} selected
                    </span>
                  )}
                  <ChevronRight 
                    size={20} 
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    style={{ color: theme.colors.textMuted }}
                  />
                </div>
              </div>
              
              {isExpanded && (
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoryCapabilities.map(capability => renderCapabilityCard(capability))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Summary Section */}
      {selectedCapabilities.length > 0 && (
        <Card variant="bordered">
          <CardContent>
            <h3 className="font-semibold mb-4" style={{ color: theme.colors.text }}>
              Selection Summary
            </h3>
            
            <div className="space-y-4">
              {/* Selected Capabilities */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Check size={16} style={{ color: theme.colors.success }} />
                  <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                    Selected Capabilities ({selectedCapabilities.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedCapabilities.map(capId => (
                    <span
                      key={capId}
                      className="px-2 py-1 text-xs rounded"
                      style={{
                        backgroundColor: theme.colors.primaryBackground,
                        color: theme.colors.primary
                      }}
                    >
                      {allCapabilities[capId]?.name || capId}
                    </span>
                  ))}
                </div>
              </div>

              {/* Missing Dependencies */}
              {dependencies.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={16} style={{ color: theme.colors.warning }} />
                    <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                      Missing Dependencies
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dependencies.map(depId => (
                      <button
                        key={depId}
                        className="px-2 py-1 text-xs rounded cursor-pointer"
                        style={{
                          backgroundColor: `${theme.colors.warning}20`,
                          color: theme.colors.warning,
                          border: `1px solid ${theme.colors.warning}`
                        }}
                        onClick={() => toggleCapability(depId)}
                      >
                        + {allCapabilities[depId]?.name || depId}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated Workflows */}
              {suggestedWorkflows.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch size={16} style={{ color: theme.colors.info }} />
                    <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                      Generated Workflows ({suggestedWorkflows.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedWorkflows.map(workflow => (
                      <span
                        key={workflow.id}
                        className="px-2 py-1 text-xs rounded"
                        style={{
                          backgroundColor: theme.colors.secondaryBackground,
                          color: theme.colors.textSecondary
                        }}
                      >
                        {workflow.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Required Entities */}
              {requiredEntities.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Database size={16} style={{ color: theme.colors.info }} />
                    <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                      Required Entities ({requiredEntities.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {requiredEntities.map(entity => (
                      <span
                        key={entity}
                        className="px-2 py-1 text-xs rounded"
                        style={{
                          backgroundColor: theme.colors.surface,
                          color: theme.colors.textMuted,
                          border: `1px solid ${theme.colors.border}`
                        }}
                      >
                        {entity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {dependencies.length > 0 && (
              <div className="mt-4 p-3 rounded" style={{
                backgroundColor: `${theme.colors.warning}10`,
                border: `1px solid ${theme.colors.warning}50`
              }}>
                <div className="flex items-start gap-2">
                  <Info size={16} style={{ color: theme.colors.warning, marginTop: '2px' }} />
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    Some selected capabilities have dependencies. Click on the missing dependencies above to add them automatically.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};