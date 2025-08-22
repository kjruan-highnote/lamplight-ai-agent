import React, { useState, useEffect } from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { 
  GeneratorType, 
  GeneratorFormData, 
  GeneratorOptions,
  ExportFormat,
  getGeneratorMetadata 
} from '../../lib/generators/types';
import { ProgramConfig, CustomerContext } from '../../types';
import { api } from '../../lib/api';
import { ChevronLeft, Loader2 } from 'lucide-react';

interface GeneratorFormProps {
  generatorType: GeneratorType;
  onSubmit: (data: GeneratorFormData) => void;
  onCancel: () => void;
  isGenerating?: boolean;
}

export const GeneratorForm: React.FC<GeneratorFormProps> = ({
  generatorType,
  onSubmit,
  onCancel,
  isGenerating = false,
}) => {
  const { theme } = useTheme();
  const metadata = getGeneratorMetadata(generatorType);
  
  // Form state
  const [programs, setPrograms] = useState<ProgramConfig[]>([]);
  const [contexts, setContexts] = useState<CustomerContext[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedContext, setSelectedContext] = useState<string>('');
  const [exportFormats, setExportFormats] = useState<ExportFormat[]>(['markdown']);
  const [options, setOptions] = useState<GeneratorOptions>({
    solutionSections: {
      executiveSummary: true,
      technicalOverview: true,
      useCases: true,
      workflows: true,
      apiReference: true,
      integrationGuide: true,
      securityCompliance: false,
      appendices: false,
    },
    workflowOptions: {
      includeAliases: true,
      showTimestamps: false,
      colorScheme: 'default',
    },
    erdOptions: {
      showRelationships: true,
      includeIndexes: false,
      layout: 'horizontal',
    },
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load programs and contexts on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [programsData, contextsData] = await Promise.all([
          api.programs.list(),
          api.contexts.list(),
        ]);
        setPrograms(programsData);
        setContexts(contextsData);
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProgram && metadata.requiredFields.includes('programId')) {
      setError('Please select a program');
      return;
    }
    
    if (!selectedContext && metadata.requiredFields.includes('contextId')) {
      setError('Please select a customer context');
      return;
    }
    
    onSubmit({
      programId: selectedProgram,
      contextId: selectedContext || undefined,
      options,
      exportFormats,
    });
  };

  const toggleExportFormat = (format: ExportFormat) => {
    setExportFormats(prev => 
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const toggleSolutionSection = (section: keyof NonNullable<GeneratorOptions['solutionSections']>) => {
    setOptions(prev => ({
      ...prev,
      solutionSections: {
        ...prev.solutionSections,
        [section]: !prev.solutionSections?.[section],
      },
    }));
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '400px',
      }}>
        <Loader2 size={32} style={{ color: theme.colors.primary }} className="animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card variant="default" padding="lg">
        <CardContent>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: theme.spacing.xl,
            paddingBottom: theme.spacing.md,
            borderBottom: `1px solid ${theme.colors.border}`,
          }}>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              style={{ marginRight: theme.spacing.md }}
            >
              <ChevronLeft size={20} />
            </Button>
            <div>
              <h2 style={{
                fontSize: theme.typography.fontSize.xl,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text,
              }}>
                {metadata.icon} {metadata.name}
              </h2>
              <p style={{
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.textMuted,
              }}>
                {metadata.description}
              </p>
            </div>
          </div>

          {error && (
            <div style={{
              padding: theme.spacing.md,
              marginBottom: theme.spacing.lg,
              backgroundColor: theme.colors.danger + '20',
              border: `1px solid ${theme.colors.danger}`,
              borderRadius: theme.borders.radius.md,
              color: theme.colors.danger,
            }}>
              {error}
            </div>
          )}

          {/* Program Selection */}
          {(metadata.requiredFields.includes('programId') || metadata.optionalFields.includes('programId')) && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <label style={{
                display: 'block',
                marginBottom: theme.spacing.sm,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text,
              }}>
                Program {metadata.requiredFields.includes('programId') && '*'}
              </label>
              <Select
                value={selectedProgram}
                onChange={(value) => setSelectedProgram(value)}
                placeholder="Select a program..."
                options={[
                  { value: '', label: 'Select a program...' },
                  ...programs.map(program => ({
                    value: program._id || '',
                    label: program.metadata?.name || program.program_type || 'Unknown'
                  }))
                ]}
              />
            </div>
          )}

          {/* Context Selection */}
          {(metadata.requiredFields.includes('contextId') || metadata.optionalFields.includes('contextId')) && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <label style={{
                display: 'block',
                marginBottom: theme.spacing.sm,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text,
              }}>
                Customer Context {metadata.requiredFields.includes('contextId') && '*'}
              </label>
              <Select
                value={selectedContext}
                onChange={(value) => setSelectedContext(value)}
                placeholder="None (Generic Solution)"
                options={[
                  { value: '', label: 'None (Generic Solution)' },
                  ...contexts.map(context => ({
                    value: context._id || '',
                    label: context.customer.name
                  }))
                ]}
              />
            </div>
          )}

          {/* Generator-specific Options */}
          {generatorType === 'solution' && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <label style={{
                display: 'block',
                marginBottom: theme.spacing.sm,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text,
              }}>
                Document Sections
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: theme.spacing.sm,
              }}>
                {Object.entries(options.solutionSections || {}).map(([key, value]) => (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: theme.spacing.sm,
                      borderRadius: theme.borders.radius.sm,
                      backgroundColor: theme.colors.surface,
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => toggleSolutionSection(key as any)}
                      style={{ marginRight: theme.spacing.xs }}
                    />
                    <span style={{ 
                      fontSize: theme.typography.fontSize.sm,
                      color: theme.colors.text,
                      textTransform: 'capitalize',
                    }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {generatorType === 'workflow' && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <label style={{
                display: 'block',
                marginBottom: theme.spacing.sm,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text,
              }}>
                Diagram Options
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={options.workflowOptions?.includeAliases}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      workflowOptions: {
                        ...prev.workflowOptions,
                        includeAliases: e.target.checked,
                      },
                    }))}
                    style={{ marginRight: theme.spacing.xs }}
                  />
                  <span style={{ fontSize: theme.typography.fontSize.sm }}>Include Aliases</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={options.workflowOptions?.showTimestamps}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      workflowOptions: {
                        ...prev.workflowOptions,
                        showTimestamps: e.target.checked,
                      },
                    }))}
                    style={{ marginRight: theme.spacing.xs }}
                  />
                  <span style={{ fontSize: theme.typography.fontSize.sm }}>Show Timestamps</span>
                </label>
              </div>
            </div>
          )}

          {/* Export Formats */}
          <div style={{ marginBottom: theme.spacing.lg }}>
            <label style={{
              display: 'block',
              marginBottom: theme.spacing.sm,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text,
            }}>
              Export Formats
            </label>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}>
              {metadata.exportFormats.map(format => (
                <label
                  key={format}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    borderRadius: theme.borders.radius.sm,
                    backgroundColor: exportFormats.includes(format) 
                      ? theme.colors.primary + '20'
                      : theme.colors.surface,
                    border: `1px solid ${
                      exportFormats.includes(format) 
                        ? theme.colors.primary 
                        : theme.colors.border
                    }`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={exportFormats.includes(format)}
                    onChange={() => toggleExportFormat(format)}
                    style={{ marginRight: theme.spacing.xs }}
                  />
                  <span style={{ 
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.text,
                    textTransform: 'uppercase',
                  }}>
                    {format}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end',
            gap: theme.spacing.md,
            paddingTop: theme.spacing.lg,
            borderTop: `1px solid ${theme.colors.border}`,
          }}>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isGenerating || exportFormats.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ marginRight: theme.spacing.xs }} />
                  Generating...
                </>
              ) : (
                `Generate ${metadata.name}`
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};