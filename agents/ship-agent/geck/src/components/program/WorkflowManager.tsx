import React, { useState } from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { 
  Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight,
  GripVertical, GitBranch, Clock, Copy, FileText, Layers
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Card } from '../ui/Card';
import { Modal, ConfirmModal } from '../ui/Modal';
import { Workflow, WorkflowStep } from '../../types';
import { OperationSelector, OPERATION_TEMPLATES } from './OperationSelector';

// Extend the base types with additional properties we need for management
interface ExtendedWorkflowStep extends WorkflowStep {
  condition?: string;
  order?: number;
}

interface ExtendedWorkflow extends Workflow {
  order?: number;
  tags?: string[];
  timeout?: number;
  retries?: number;
}

interface WorkflowManagerProps {
  workflows: Record<string, Workflow>;
  onChange: (workflows: Record<string, Workflow>) => void;
  operations?: string[]; // Available operations for steps
}

export const WorkflowManager: React.FC<WorkflowManagerProps> = ({
  workflows,
  onChange,
  operations = []
}) => {
  const { theme } = useTheme();
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [editingWorkflow, setEditingWorkflow] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<{ workflowKey: string; stepIndex: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'workflow' | 'step'; key: string; index?: number } | null>(null);
  const [addWorkflowModalOpen, setAddWorkflowModalOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [bulkAddStepsModal, setBulkAddStepsModal] = useState<{ workflowKey: string } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // Form states
  const [workflowForm, setWorkflowForm] = useState<Partial<ExtendedWorkflow>>({});
  const [stepForm, setStepForm] = useState<Partial<ExtendedWorkflowStep>>({});
  const [newWorkflowForm, setNewWorkflowForm] = useState<{
    key: string;
    name: string;
    description: string;
    required: boolean;
    timeout?: number;
    retries?: number;
    tags?: string;
  }>({
    key: '',
    name: '',
    description: '',
    required: false,
    timeout: undefined,
    retries: undefined,
    tags: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Drag and drop states
  const [draggedWorkflow, setDraggedWorkflow] = useState<string | null>(null);
  const [draggedStep, setDraggedStep] = useState<{ workflowKey: string; stepIndex: number } | null>(null);
  const [dragOverWorkflow, setDragOverWorkflow] = useState<string | null>(null);
  const [dragOverStep, setDragOverStep] = useState<{ workflowKey: string; stepIndex: number } | null>(null);

  // Convert workflows object to sorted array
  const workflowEntries = Object.entries(workflows).sort((a, b) => {
    const orderA = (a[1] as ExtendedWorkflow).order ?? 999;
    const orderB = (b[1] as ExtendedWorkflow).order ?? 999;
    return orderA - orderB;
  });

  const toggleWorkflow = (key: string) => {
    const newExpanded = new Set(expandedWorkflows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedWorkflows(newExpanded);
  };

  const validateWorkflowForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!newWorkflowForm.key.trim()) {
      errors.key = 'Workflow key is required';
    } else if (!/^[a-z_]+$/.test(newWorkflowForm.key)) {
      errors.key = 'Key must be lowercase letters and underscores only';
    } else if (workflows[newWorkflowForm.key]) {
      errors.key = 'A workflow with this key already exists';
    }
    
    if (!newWorkflowForm.name.trim()) {
      errors.name = 'Workflow name is required';
    }
    
    if (newWorkflowForm.timeout !== undefined && newWorkflowForm.timeout < 0) {
      errors.timeout = 'Timeout must be a positive number';
    }
    
    if (newWorkflowForm.retries !== undefined && newWorkflowForm.retries < 0) {
      errors.retries = 'Retries must be a positive number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddWorkflow = () => {
    if (!validateWorkflowForm()) return;
    
    const newWorkflow: Workflow = {
      name: newWorkflowForm.name,
      description: newWorkflowForm.description,
      required: newWorkflowForm.required,
      steps: []
    };
    
    // Add extended properties
    const extWorkflow = newWorkflow as ExtendedWorkflow;
    extWorkflow.order = Object.keys(workflows).length;
    if (newWorkflowForm.timeout) extWorkflow.timeout = newWorkflowForm.timeout;
    if (newWorkflowForm.retries) extWorkflow.retries = newWorkflowForm.retries;
    if (newWorkflowForm.tags) {
      extWorkflow.tags = newWorkflowForm.tags.split(',').map(t => t.trim()).filter(t => t);
    }
    
    onChange({
      ...workflows,
      [newWorkflowForm.key]: newWorkflow
    });
    
    setExpandedWorkflows(new Set(Array.from(expandedWorkflows).concat(newWorkflowForm.key)));
    setAddWorkflowModalOpen(false);
    
    // Reset form
    setNewWorkflowForm({
      key: '',
      name: '',
      description: '',
      required: false,
      timeout: undefined,
      retries: undefined,
      tags: ''
    });
    setFormErrors({});
  };

  const handleWorkflowKeyChange = (key: string) => {
    setNewWorkflowForm(prev => ({
      ...prev,
      key,
      name: prev.name || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
  };

  const handleEditWorkflow = (key: string) => {
    setWorkflowForm(workflows[key]);
    setEditingWorkflow(key);
  };

  const handleSaveWorkflow = (key: string) => {
    onChange({
      ...workflows,
      [key]: {
        ...workflows[key],
        ...workflowForm
      }
    });
    setEditingWorkflow(null);
    setWorkflowForm({});
  };

  const handleDeleteWorkflow = (key: string) => {
    const newWorkflows = { ...workflows };
    delete newWorkflows[key];
    
    // Reorder remaining workflows
    Object.entries(newWorkflows).forEach(([k, w], index) => {
      (w as ExtendedWorkflow).order = index;
    });
    
    onChange(newWorkflows);
    setDeleteConfirm(null);
  };

  const handleDuplicateWorkflow = (key: string) => {
    const workflow = workflows[key];
    const newKey = `${key}_copy`;
    let finalKey = newKey;
    let counter = 1;
    
    // Find unique key
    while (workflows[finalKey]) {
      finalKey = `${newKey}_${counter}`;
      counter++;
    }
    
    const duplicatedWorkflow: Workflow = {
      ...workflow,
      name: `${workflow.name} (Copy)`,
      steps: workflow.steps.map(step => ({ ...step }))
    };
    
    onChange({
      ...workflows,
      [finalKey]: duplicatedWorkflow
    });
    
    // Expand the new workflow
    setExpandedWorkflows(new Set(Array.from(expandedWorkflows).concat(finalKey)));
  };

  const handleAddStep = (workflowKey: string) => {
    const workflow = workflows[workflowKey];
    const newStep: WorkflowStep = {
      operation: '',
      description: '',
      required: false
    };
    (newStep as ExtendedWorkflowStep).order = workflow.steps.length;
    
    onChange({
      ...workflows,
      [workflowKey]: {
        ...workflow,
        steps: [...workflow.steps, newStep]
      }
    });
  };

  const handleEditStep = (workflowKey: string, stepIndex: number) => {
    setStepForm(workflows[workflowKey].steps[stepIndex]);
    setEditingStep({ workflowKey, stepIndex });
  };

  const handleSaveStep = () => {
    if (!editingStep) return;
    
    const { workflowKey, stepIndex } = editingStep;
    const workflow = workflows[workflowKey];
    const newSteps = [...workflow.steps];
    newSteps[stepIndex] = {
      ...newSteps[stepIndex],
      ...stepForm
    };
    
    onChange({
      ...workflows,
      [workflowKey]: {
        ...workflow,
        steps: newSteps
      }
    });
    
    setEditingStep(null);
    setStepForm({});
  };

  const handleDeleteStep = (workflowKey: string, stepIndex: number) => {
    const workflow = workflows[workflowKey];
    const newSteps = workflow.steps.filter((_, i) => i !== stepIndex);
    
    // Reorder remaining steps
    newSteps.forEach((step, index) => {
      (step as ExtendedWorkflowStep).order = index;
    });
    
    onChange({
      ...workflows,
      [workflowKey]: {
        ...workflow,
        steps: newSteps
      }
    });
    
    setDeleteConfirm(null);
  };

  // Drag and drop handlers for workflows
  const handleWorkflowDragStart = (key: string) => {
    setDraggedWorkflow(key);
  };

  const handleWorkflowDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    setDragOverWorkflow(key);
  };

  const handleWorkflowDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!draggedWorkflow || draggedWorkflow === targetKey) {
      setDraggedWorkflow(null);
      setDragOverWorkflow(null);
      return;
    }

    const entries = Object.entries(workflows);
    const draggedIndex = entries.findIndex(([k]) => k === draggedWorkflow);
    const targetIndex = entries.findIndex(([k]) => k === targetKey);

    // Reorder the array
    const [removed] = entries.splice(draggedIndex, 1);
    entries.splice(targetIndex, 0, removed);

    // Create new workflows object with updated order
    const newWorkflows: Record<string, Workflow> = {};
    entries.forEach(([key, workflow], index) => {
      const extWorkflow = { ...workflow } as ExtendedWorkflow;
      extWorkflow.order = index;
      newWorkflows[key] = extWorkflow;
    });

    onChange(newWorkflows);
    setDraggedWorkflow(null);
    setDragOverWorkflow(null);
  };

  // Drag and drop handlers for steps
  const handleStepDragStart = (workflowKey: string, stepIndex: number) => {
    setDraggedStep({ workflowKey, stepIndex });
  };

  const handleStepDragOver = (e: React.DragEvent, workflowKey: string, stepIndex: number) => {
    e.preventDefault();
    setDragOverStep({ workflowKey, stepIndex });
  };

  const handleStepDrop = (e: React.DragEvent, targetWorkflowKey: string, targetStepIndex: number) => {
    e.preventDefault();
    if (!draggedStep) {
      setDraggedStep(null);
      setDragOverStep(null);
      return;
    }

    const { workflowKey: sourceWorkflowKey, stepIndex: sourceStepIndex } = draggedStep;
    
    // Only allow reordering within the same workflow
    if (sourceWorkflowKey !== targetWorkflowKey) {
      setDraggedStep(null);
      setDragOverStep(null);
      return;
    }

    if (sourceStepIndex === targetStepIndex) {
      setDraggedStep(null);
      setDragOverStep(null);
      return;
    }

    const workflow = workflows[sourceWorkflowKey];
    const newSteps = [...workflow.steps];
    const [removed] = newSteps.splice(sourceStepIndex, 1);
    newSteps.splice(targetStepIndex, 0, removed);

    // Update order
    newSteps.forEach((step, index) => {
      (step as ExtendedWorkflowStep).order = index;
    });

    onChange({
      ...workflows,
      [sourceWorkflowKey]: {
        ...workflow,
        steps: newSteps
      }
    });

    setDraggedStep(null);
    setDragOverStep(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
            Workflow Management
          </h3>
          <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
            Define and organize your program workflows. Drag to reorder.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={16} />}
          onClick={() => setAddWorkflowModalOpen(true)}
        >
          Add Workflow
        </Button>
      </div>

      {/* Workflows List */}
      <div className="space-y-3">
        {workflowEntries.map(([key, workflow]) => {
          const extWorkflow = workflow as ExtendedWorkflow;
          const isExpanded = expandedWorkflows.has(key);
          const isEditing = editingWorkflow === key;
          const isDragOver = dragOverWorkflow === key;

          return (
            <Card
              key={key}
              variant="bordered"
              className="transition-all"
              style={{
                borderColor: isDragOver ? theme.colors.primary : theme.colors.border,
                backgroundColor: isDragOver ? theme.colors.primaryBackground : theme.colors.surface,
                opacity: draggedWorkflow === key ? 0.5 : 1
              }}
              draggable
              onDragStart={() => handleWorkflowDragStart(key)}
              onDragOver={(e) => handleWorkflowDragOver(e, key)}
              onDrop={(e) => handleWorkflowDrop(e, key)}
              onDragEnd={() => {
                setDraggedWorkflow(null);
                setDragOverWorkflow(null);
              }}
            >
              <div className="p-4">
                {/* Workflow Header */}
                <div className="flex items-start gap-3">
                  {/* Drag Handle */}
                  <div 
                    className="mt-1 cursor-move"
                    style={{ color: theme.colors.textMuted }}
                  >
                    <GripVertical size={20} />
                  </div>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() => toggleWorkflow(key)}
                    className="mt-1"
                    style={{ color: theme.colors.textMuted }}
                  >
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>

                  {/* Workflow Content */}
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          value={workflowForm.name || ''}
                          onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                          placeholder="Workflow name"
                        />
                        <Textarea
                          value={workflowForm.description || ''}
                          onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                          placeholder="Workflow description"
                          rows={2}
                        />
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={workflowForm.required || false}
                              onChange={(e) => setWorkflowForm({ ...workflowForm, required: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm" style={{ color: theme.colors.text }}>Required</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm" style={{ color: theme.colors.textMuted }}>Timeout (ms):</span>
                            <Input
                              type="number"
                              value={workflowForm.timeout || ''}
                              onChange={(e) => setWorkflowForm({ ...workflowForm, timeout: parseInt(e.target.value) || undefined })}
                              placeholder="5000"
                              className="w-24"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm" style={{ color: theme.colors.textMuted }}>Retries:</span>
                            <Input
                              type="number"
                              value={workflowForm.retries || ''}
                              onChange={(e) => setWorkflowForm({ ...workflowForm, retries: parseInt(e.target.value) || undefined })}
                              placeholder="3"
                              className="w-16"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <GitBranch size={16} style={{ color: theme.colors.primary }} />
                          <h4 className="font-semibold" style={{ color: theme.colors.text }}>
                            {workflow.name}
                          </h4>
                          {workflow.required && (
                            <span 
                              className="px-2 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: `${theme.colors.danger}20`,
                                color: theme.colors.danger
                              }}
                            >
                              Required
                            </span>
                          )}
                          <span 
                            className="px-2 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor: theme.colors.secondaryBackground,
                              color: theme.colors.textMuted
                            }}
                          >
                            {workflow.steps.length} steps
                          </span>
                        </div>
                        <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                          {workflow.description || 'No description'}
                        </p>
                        {(extWorkflow.timeout || extWorkflow.retries) && (
                          <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: theme.colors.textMuted }}>
                            {extWorkflow.timeout && (
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                Timeout: {extWorkflow.timeout}ms
                              </span>
                            )}
                            {extWorkflow.retries && (
                              <span>Retries: {extWorkflow.retries}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveWorkflow(key)}
                          className="p-2 rounded transition-all"
                          style={{ color: theme.colors.success }}
                          title="Save"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingWorkflow(null);
                            setWorkflowForm({});
                          }}
                          className="p-2 rounded transition-all"
                          style={{ color: theme.colors.textMuted }}
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleDuplicateWorkflow(key)}
                          className="p-2 rounded transition-all"
                          style={{ color: theme.colors.textMuted }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = theme.colors.info;
                            e.currentTarget.style.backgroundColor = `${theme.colors.info}20`;
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
                          onClick={() => handleEditWorkflow(key)}
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
                          onClick={() => setDeleteConfirm({ type: 'workflow', key })}
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
                      </>
                    )}
                  </div>
                </div>

                {/* Workflow Steps */}
                {isExpanded && (
                  <div className="mt-4 ml-12 space-y-2">
                    {workflow.steps.map((step, stepIndex) => {
                      const isEditingStep = editingStep?.workflowKey === key && editingStep?.stepIndex === stepIndex;
                      const isDragOverStep = dragOverStep?.workflowKey === key && dragOverStep?.stepIndex === stepIndex;

                      return (
                        <div
                          key={stepIndex}
                          className="flex items-start gap-2 p-3 rounded-lg transition-all"
                          style={{
                            backgroundColor: isDragOverStep ? theme.colors.primaryBackground : theme.colors.background,
                            border: `1px solid ${isDragOverStep ? theme.colors.primary : theme.colors.border}`,
                            opacity: draggedStep?.workflowKey === key && draggedStep?.stepIndex === stepIndex ? 0.5 : 1
                          }}
                          draggable
                          onDragStart={() => handleStepDragStart(key, stepIndex)}
                          onDragOver={(e) => handleStepDragOver(e, key, stepIndex)}
                          onDrop={(e) => handleStepDrop(e, key, stepIndex)}
                          onDragEnd={() => {
                            setDraggedStep(null);
                            setDragOverStep(null);
                          }}
                        >
                          {/* Step Drag Handle */}
                          <div 
                            className="cursor-move mt-1"
                            style={{ color: theme.colors.textMuted }}
                          >
                            <GripVertical size={16} />
                          </div>

                          {/* Step Number */}
                          <div 
                            className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: theme.colors.primaryBackground,
                              color: theme.colors.primary
                            }}
                          >
                            {stepIndex + 1}
                          </div>

                          {/* Step Content */}
                          <div className="flex-1">
                            {isEditingStep ? (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <OperationSelector
                                      operations={operations}
                                      value={stepForm.operation || ''}
                                      onChange={(value) => setStepForm({ ...stepForm, operation: value })}
                                      placeholder="Search or type operation name..."
                                      allowCustom={true}
                                    />
                                  </div>
                                  <label className="flex items-center gap-2 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={stepForm.required || false}
                                      onChange={(e) => setStepForm({ ...stepForm, required: e.target.checked })}
                                      className="rounded"
                                    />
                                    <span className="text-sm" style={{ color: theme.colors.text }}>Required</span>
                                  </label>
                                </div>
                                <Input
                                  value={stepForm.description || ''}
                                  onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })}
                                  placeholder="Step description (optional)"
                                />
                                <Input
                                  value={stepForm.condition || ''}
                                  onChange={(e) => setStepForm({ ...stepForm, condition: e.target.value })}
                                  placeholder="Condition (optional, e.g., status === 'active')"
                                />
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: theme.colors.text }}>
                                    {step.operation || 'Unnamed step'}
                                  </span>
                                  {step.required && (
                                    <span 
                                      className="px-1.5 py-0.5 text-xs rounded"
                                      style={{
                                        backgroundColor: `${theme.colors.warning}20`,
                                        color: theme.colors.warning,
                                        fontSize: '10px'
                                      }}
                                    >
                                      Required
                                    </span>
                                  )}
                                </div>
                                {step.description && (
                                  <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                                    {step.description}
                                  </p>
                                )}
                                {(step as ExtendedWorkflowStep).condition && (
                                  <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                                    Condition: {(step as ExtendedWorkflowStep).condition}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Step Actions */}
                          <div className="flex gap-1">
                            {isEditingStep ? (
                              <>
                                <button
                                  onClick={handleSaveStep}
                                  className="p-1 rounded transition-all"
                                  style={{ color: theme.colors.success }}
                                  title="Save"
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingStep(null);
                                    setStepForm({});
                                  }}
                                  className="p-1 rounded transition-all"
                                  style={{ color: theme.colors.textMuted }}
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditStep(key, stepIndex)}
                                  className="p-1 rounded transition-all"
                                  style={{ color: theme.colors.textMuted }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = theme.colors.primary;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = theme.colors.textMuted;
                                  }}
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm({ type: 'step', key, index: stepIndex })}
                                  className="p-1 rounded transition-all"
                                  style={{ color: theme.colors.textMuted }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = theme.colors.danger;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = theme.colors.textMuted;
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
                    })}

                    {/* Add Step Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddStep(key)}
                        className="flex-1 p-2 border-2 border-dashed rounded-lg transition-all flex items-center justify-center gap-2"
                        style={{
                          borderColor: theme.colors.border,
                          color: theme.colors.textMuted,
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = theme.colors.primaryBorder;
                          e.currentTarget.style.color = theme.colors.primary;
                          e.currentTarget.style.backgroundColor = theme.colors.primaryBackground;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = theme.colors.border;
                          e.currentTarget.style.color = theme.colors.textMuted;
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Plus size={16} />
                        <span className="text-sm">Add Step</span>
                      </button>
                      
                      <button
                        onClick={() => setBulkAddStepsModal({ workflowKey: key })}
                        className="px-3 py-2 border-2 border-dashed rounded-lg transition-all flex items-center gap-2"
                        style={{
                          borderColor: theme.colors.border,
                          color: theme.colors.textMuted,
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = theme.colors.info;
                          e.currentTarget.style.color = theme.colors.info;
                          e.currentTarget.style.backgroundColor = `${theme.colors.info}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = theme.colors.border;
                          e.currentTarget.style.color = theme.colors.textMuted;
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Add multiple steps at once"
                      >
                        <Layers size={16} />
                        <span className="text-sm">Bulk Add</span>
                      </button>
                      
                      <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="px-3 py-2 border-2 border-dashed rounded-lg transition-all flex items-center gap-2"
                        style={{
                          borderColor: theme.colors.border,
                          color: theme.colors.textMuted,
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = theme.colors.warning;
                          e.currentTarget.style.color = theme.colors.warning;
                          e.currentTarget.style.backgroundColor = `${theme.colors.warning}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = theme.colors.border;
                          e.currentTarget.style.color = theme.colors.textMuted;
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Use predefined templates"
                      >
                        <FileText size={16} />
                        <span className="text-sm">Templates</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {workflowEntries.length === 0 && (
          <div 
            className="text-center py-12 rounded-lg border-2 border-dashed"
            style={{
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface
            }}
          >
            <GitBranch size={48} className="mx-auto mb-3 opacity-50" style={{ color: theme.colors.textMuted }} />
            <p style={{ color: theme.colors.textMuted }}>
              No workflows defined
            </p>
            <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
              Click "Add Workflow" to create your first workflow
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modals */}
      {deleteConfirm && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => {
            if (deleteConfirm.type === 'workflow') {
              handleDeleteWorkflow(deleteConfirm.key);
            } else if (deleteConfirm.type === 'step' && deleteConfirm.index !== undefined) {
              handleDeleteStep(deleteConfirm.key, deleteConfirm.index);
            }
          }}
          title={deleteConfirm.type === 'workflow' ? 'Delete Workflow' : 'Delete Step'}
          message={`Are you sure you want to delete this ${deleteConfirm.type}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          type="danger"
        />
      )}

      {/* Add Workflow Modal */}
      <Modal
        isOpen={addWorkflowModalOpen}
        onClose={() => {
          setAddWorkflowModalOpen(false);
          setNewWorkflowForm({
            key: '',
            name: '',
            description: '',
            required: false,
            timeout: undefined,
            retries: undefined,
            tags: ''
          });
          setFormErrors({});
        }}
        title="Add Workflow"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAddWorkflowModalOpen(false);
                setNewWorkflowForm({
                  key: '',
                  name: '',
                  description: '',
                  required: false,
                  timeout: undefined,
                  retries: undefined,
                  tags: ''
                });
                setFormErrors({});
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddWorkflow}
              icon={<Plus size={16} />}
            >
              Add Workflow
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Workflow Key */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Workflow Key <span className="text-red-500">*</span>
            </label>
            <Input
              value={newWorkflowForm.key}
              onChange={(e) => handleWorkflowKeyChange(e.target.value)}
              placeholder="e.g., card_issuance"
              error={!!formErrors.key}
            />
            {formErrors.key && (
              <p className="text-xs mt-1" style={{ color: theme.colors.danger }}>
                {formErrors.key}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
              Must be lowercase letters and underscores only
            </p>
          </div>

          {/* Workflow Name */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Workflow Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={newWorkflowForm.name}
              onChange={(e) => setNewWorkflowForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Card Issuance"
              error={!!formErrors.name}
            />
            {formErrors.name && (
              <p className="text-xs mt-1" style={{ color: theme.colors.danger }}>
                {formErrors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Description
            </label>
            <Textarea
              value={newWorkflowForm.description}
              onChange={(e) => setNewWorkflowForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this workflow does..."
              rows={3}
            />
          </div>

          {/* Required Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="workflow-required"
              checked={newWorkflowForm.required}
              onChange={(e) => setNewWorkflowForm(prev => ({ ...prev, required: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="workflow-required" className="text-sm" style={{ color: theme.colors.text }}>
              Required workflow
            </label>
            <p className="text-xs ml-auto" style={{ color: theme.colors.textMuted }}>
              Required workflows must be implemented
            </p>
          </div>

          {/* Advanced Options */}
          <div className="grid grid-cols-2 gap-4">
            {/* Timeout */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Timeout (ms)
              </label>
              <Input
                type="number"
                value={newWorkflowForm.timeout || ''}
                onChange={(e) => setNewWorkflowForm(prev => ({ 
                  ...prev, 
                  timeout: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                placeholder="5000"
                error={!!formErrors.timeout}
              />
              {formErrors.timeout && (
                <p className="text-xs mt-1" style={{ color: theme.colors.danger }}>
                  {formErrors.timeout}
                </p>
              )}
            </div>

            {/* Retries */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                Retries
              </label>
              <Input
                type="number"
                value={newWorkflowForm.retries || ''}
                onChange={(e) => setNewWorkflowForm(prev => ({ 
                  ...prev, 
                  retries: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                placeholder="3"
                error={!!formErrors.retries}
              />
              {formErrors.retries && (
                <p className="text-xs mt-1" style={{ color: theme.colors.danger }}>
                  {formErrors.retries}
                </p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
              Tags
            </label>
            <Input
              value={newWorkflowForm.tags}
              onChange={(e) => setNewWorkflowForm(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g., payment, card, funding (comma-separated)"
            />
            <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
              Enter comma-separated tags for categorization
            </p>
          </div>
        </div>
      </Modal>

      {/* Bulk Add Steps Modal */}
      {bulkAddStepsModal && (
        <Modal
          isOpen={true}
          onClose={() => setBulkAddStepsModal(null)}
          title="Add Multiple Steps"
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setBulkAddStepsModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  // Implementation for bulk add
                  setBulkAddStepsModal(null);
                }}
                icon={<Plus size={16} />}
              >
                Add Selected Steps
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm" style={{ color: theme.colors.textMuted }}>
              Select multiple operations to add as steps to your workflow. You can also use predefined templates.
            </p>
            
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                Use Template (Optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(OPERATION_TEMPLATES).map(([category, ops]) => (
                  <button
                    key={category}
                    onClick={() => {
                      const workflow = workflows[bulkAddStepsModal.workflowKey];
                      const newSteps = ops.map(op => ({
                        operation: op.name,
                        description: op.description || '',
                        required: false
                      }));
                      
                      onChange({
                        ...workflows,
                        [bulkAddStepsModal.workflowKey]: {
                          ...workflow,
                          steps: [...workflow.steps, ...newSteps]
                        }
                      });
                      
                      setBulkAddStepsModal(null);
                    }}
                    className="p-3 rounded-lg border transition-all text-left"
                    style={{
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primaryBorder;
                      e.currentTarget.style.backgroundColor = theme.colors.primaryBackground;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                      e.currentTarget.style.backgroundColor = theme.colors.surface;
                    }}
                  >
                    <div className="font-medium text-sm capitalize" style={{ color: theme.colors.text }}>
                      {category} Operations
                    </div>
                    <div className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
                      {ops.length} operations
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Operations List */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                Or Select Individual Operations
              </label>
              <div className="max-h-64 overflow-y-auto border rounded-lg p-2" style={{
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background
              }}>
                {operations.length > 0 ? (
                  <div className="space-y-1">
                    {operations.map(op => (
                      <label
                        key={op}
                        className="flex items-center gap-2 p-2 rounded hover:bg-opacity-50 cursor-pointer"
                        style={{
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.colors.primaryBackground;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          className="rounded"
                          onChange={(e) => {
                            if (e.target.checked) {
                              const workflow = workflows[bulkAddStepsModal.workflowKey];
                              const newStep: WorkflowStep = {
                                operation: op,
                                description: '',
                                required: false
                              };
                              
                              onChange({
                                ...workflows,
                                [bulkAddStepsModal.workflowKey]: {
                                  ...workflow,
                                  steps: [...workflow.steps, newStep]
                                }
                              });
                            }
                          }}
                        />
                        <span className="text-sm" style={{ color: theme.colors.text }}>
                          {op}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-center py-4" style={{ color: theme.colors.textMuted }}>
                    No operations available. You can still add custom operations manually.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};