import React, { useState } from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { 
  Plus, Edit2, Trash2, Save, X, 
  DollarSign, Shield, Lock, Eye, Settings,
  Check, AlertCircle
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card, CardContent } from '../ui/Card';
import { CAPABILITY_CATEGORIES } from '../../config/capabilities';

export interface CustomCapability {
  id: string;
  name: string;
  description: string;
  category: 'funding' | 'authorization' | 'controls' | 'monitoring' | 'management' | 'custom';
  isCustom: boolean;
  requiredWorkflows?: string[];
  suggestedWorkflows?: string[];
  requiredEntities?: string[];
  dependencies?: string[];
}

interface CapabilityManagerProps {
  capabilities: CustomCapability[];
  onAdd: (capability: CustomCapability) => void;
  onEdit: (id: string, capability: CustomCapability) => void;
  onRemove: (id: string) => void;
  existingCapabilityIds?: string[];
}

export const CapabilityManager: React.FC<CapabilityManagerProps> = ({
  capabilities,
  onAdd,
  onEdit,
  onRemove,
  existingCapabilityIds = []
}) => {
  const { theme } = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CustomCapability>>({
    category: 'custom'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categoryOptions = [
    ...Object.entries(CAPABILITY_CATEGORIES).map(([id, cat]) => ({
      value: id,
      label: cat.name
    })),
    { value: 'custom', label: 'Custom' }
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'funding': return <DollarSign size={16} />;
      case 'authorization': return <Shield size={16} />;
      case 'controls': return <Lock size={16} />;
      case 'monitoring': return <Eye size={16} />;
      case 'management': return <Settings size={16} />;
      default: return <Settings size={16} />;
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.id?.trim()) {
      newErrors.id = 'ID is required';
    } else if (!/^[a-z_]+$/.test(formData.id)) {
      newErrors.id = 'ID must be lowercase with underscores only';
    } else if (isAdding && existingCapabilityIds.includes(formData.id)) {
      newErrors.id = 'This ID already exists';
    }
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    
    const capability: CustomCapability = {
      id: formData.id!,
      name: formData.name!,
      description: formData.description!,
      category: formData.category as any || 'custom',
      isCustom: true,
      requiredWorkflows: formData.requiredWorkflows?.filter(w => w.trim()) || [],
      suggestedWorkflows: formData.suggestedWorkflows?.filter(w => w.trim()) || [],
      requiredEntities: formData.requiredEntities?.filter(e => e.trim()) || [],
      dependencies: formData.dependencies?.filter(d => d.trim()) || []
    };
    
    if (isAdding) {
      onAdd(capability);
      setIsAdding(false);
    } else if (editingId) {
      onEdit(editingId, capability);
      setEditingId(null);
    }
    
    setFormData({ category: 'custom' });
    setErrors({});
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ category: 'custom' });
    setErrors({});
  };

  const handleEdit = (capability: CustomCapability) => {
    setEditingId(capability.id);
    setFormData(capability);
    setIsAdding(false);
  };

  const handleRemove = (id: string) => {
    if (window.confirm('Are you sure you want to remove this capability?')) {
      onRemove(id);
    }
  };

  const handleArrayInput = (field: keyof CustomCapability, value: string) => {
    const items = value.split(',').map(item => item.trim());
    setFormData(prev => ({ ...prev, [field]: items }));
  };

  const renderForm = () => (
    <Card variant="bordered" className="mb-4">
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Capability ID *
              </label>
              <Input
                value={formData.id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                placeholder="e.g., custom_validation"
                error={!!errors.id}
                disabled={!!editingId}
              />
              {errors.id && (
                <p className="text-xs mt-1" style={{ color: theme.colors.danger }}>
                  {errors.id}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Category *
              </label>
              <Select
                value={formData.category || 'custom'}
                onChange={(value) => setFormData(prev => ({ ...prev, category: value as any }))}
                options={categoryOptions}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Name *
            </label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Custom Validation Rules"
              error={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs mt-1" style={{ color: theme.colors.danger }}>
                {errors.name}
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Description *
            </label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this capability enables..."
              error={!!errors.description}
              rows={3}
            />
            {errors.description && (
              <p className="text-xs mt-1" style={{ color: theme.colors.danger }}>
                {errors.description}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Required Workflows
              </label>
              <Input
                value={formData.requiredWorkflows?.join(', ') || ''}
                onChange={(e) => handleArrayInput('requiredWorkflows', e.target.value)}
                placeholder="workflow1, workflow2 (comma-separated)"
              />
              <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                Comma-separated list of required workflow IDs
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Suggested Workflows
              </label>
              <Input
                value={formData.suggestedWorkflows?.join(', ') || ''}
                onChange={(e) => handleArrayInput('suggestedWorkflows', e.target.value)}
                placeholder="workflow3, workflow4 (comma-separated)"
              />
              <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                Optional workflows that enhance this capability
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Required Entities
              </label>
              <Input
                value={formData.requiredEntities?.join(', ') || ''}
                onChange={(e) => handleArrayInput('requiredEntities', e.target.value)}
                placeholder="Entity1, Entity2 (comma-separated)"
              />
              <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                Database entities required for this capability
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Dependencies
              </label>
              <Input
                value={formData.dependencies?.join(', ') || ''}
                onChange={(e) => handleArrayInput('dependencies', e.target.value)}
                placeholder="cap1, cap2 (comma-separated)"
              />
              <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                Other capabilities this depends on
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {isAdding ? 'Add Capability' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
          Manage Capabilities
        </h3>
        {!isAdding && !editingId && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={16} />}
            onClick={() => setIsAdding(true)}
          >
            Add Custom Capability
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && renderForm()}

      {/* Capabilities List */}
      <div className="space-y-2">
        {capabilities.map(capability => (
          <div
            key={capability.id}
            className="p-4 rounded-lg border transition-all"
            style={{
              backgroundColor: editingId === capability.id ? theme.colors.primaryBackground : theme.colors.surface,
              borderColor: editingId === capability.id ? theme.colors.primary : theme.colors.border
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {getCategoryIcon(capability.category)}
                  <h4 className="font-semibold" style={{ color: theme.colors.text }}>
                    {capability.name}
                  </h4>
                  {capability.isCustom && (
                    <span className="px-2 py-0.5 text-xs rounded" style={{
                      backgroundColor: theme.colors.primaryBackground,
                      color: theme.colors.primary
                    }}>
                      Custom
                    </span>
                  )}
                </div>
                <p className="text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                  {capability.description}
                </p>
                <div className="flex flex-wrap gap-4 text-xs" style={{ color: theme.colors.textMuted }}>
                  <span>ID: {capability.id}</span>
                  <span>Category: {capability.category}</span>
                  {capability.dependencies && capability.dependencies.length > 0 && (
                    <span>Dependencies: {capability.dependencies.length}</span>
                  )}
                  {capability.requiredWorkflows && capability.requiredWorkflows.length > 0 && (
                    <span>Workflows: {capability.requiredWorkflows.length}</span>
                  )}
                </div>
              </div>
              
              {capability.isCustom && (
                <div className="flex gap-1 ml-4">
                  <button
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
                    onClick={() => handleEdit(capability)}
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
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
                    onClick={() => handleRemove(capability.id)}
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {capabilities.length === 0 && !isAdding && (
          <div className="text-center py-8 rounded-lg border" style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border
          }}>
            <Settings size={32} className="mx-auto mb-2 opacity-50" style={{ color: theme.colors.textMuted }} />
            <p style={{ color: theme.colors.textMuted }}>
              No custom capabilities defined
            </p>
            <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
              Add custom capabilities to extend your program
            </p>
          </div>
        )}
      </div>
    </div>
  );
};