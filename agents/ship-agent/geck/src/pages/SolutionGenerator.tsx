import React, { useState, useEffect } from 'react';
import { useTheme } from '../themes/ThemeContext';
import { GeneratorCard } from '../components/generators/GeneratorCard';
import { GeneratorForm } from '../components/generators/GeneratorForm';
import { GeneratorPreview } from '../components/generators/GeneratorPreview';
import { GeneratorExport } from '../components/generators/GeneratorExport';
import { 
  GeneratorType, 
  GeneratorFormData,
  GeneratedDocument,
  GeneratorHistoryItem,
  getGeneratorsByCategory,
  ExportFormat
} from '../lib/generators/types';
import { api } from '../lib/api';
import { Sparkles, Clock, TrendingUp } from 'lucide-react';

export const SolutionGenerator: React.FC = () => {
  const { theme } = useTheme();
  const [selectedGenerator, setSelectedGenerator] = useState<GeneratorType | null>(null);
  const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [generatorHistory, setGeneratorHistory] = useState<Partial<Record<GeneratorType, GeneratorHistoryItem[]>>>({});
  const [stats, setStats] = useState({
    totalGenerated: 0,
    lastGenerated: null as Date | null,
    mostUsed: null as GeneratorType | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const generatorsByCategory = getGeneratorsByCategory();

  // Load generator history and stats
  useEffect(() => {
    loadGeneratorHistory();
  }, []);

  const loadGeneratorHistory = async () => {
    try {
      const history = await api.generators.getHistory();
      
      // Handle empty history gracefully
      if (!history || !Array.isArray(history) || history.length === 0) {
        setGeneratorHistory({});
        setStats({
          totalGenerated: 0,
          lastGenerated: null,
          mostUsed: null,
        });
        return;
      }
      
      // Group history by generator type
      const grouped: Record<GeneratorType, GeneratorHistoryItem[]> = {} as any;
      history.forEach(item => {
        if (!grouped[item.type]) {
          grouped[item.type] = [];
        }
        grouped[item.type].push(item);
      });
      setGeneratorHistory(grouped);

      // Calculate stats
      if (history.length > 0) {
        const typeCount: Record<string, number> = {};
        history.forEach(item => {
          typeCount[item.type] = (typeCount[item.type] || 0) + 1;
        });
        const mostUsed = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0][0] as GeneratorType;
        
        setStats({
          totalGenerated: history.length,
          lastGenerated: new Date(history[0].createdAt),
          mostUsed,
        });
      }
    } catch (error) {
      console.error('Failed to load generator history:', error);
      // Set default empty state on error
      setGeneratorHistory({});
      setStats({
        totalGenerated: 0,
        lastGenerated: null,
        mostUsed: null,
      });
    }
  };

  const handleGeneratorSelect = (type: GeneratorType) => {
    setSelectedGenerator(type);
    setGeneratedDocument(null);
  };

  const handleGeneratorSubmit = async (data: GeneratorFormData) => {
    if (!selectedGenerator) return;
    
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      const result = await api.generators.generate({
        type: selectedGenerator,
        config: data,
      });
      
      setGeneratedDocument(result);
      setSuccessMessage('Document generated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadGeneratorHistory(); // Refresh history
    } catch (error: any) {
      console.error('Generation failed:', error);
      setError(error.message || 'Failed to generate document. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!generatedDocument) return;
    
    setError(null);
    try {
      await api.generators.export(generatedDocument.id, format);
      setSuccessMessage(`Document exported as ${String(format || 'unknown').toUpperCase()} successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      console.error('Export failed:', error);
      setError(error.message || 'Failed to export document. Please try again.');
    }
  };

  const handleBack = () => {
    setSelectedGenerator(null);
    setGeneratedDocument(null);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{ 
          fontSize: theme.typography.fontSize['3xl'], 
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text,
          marginBottom: theme.spacing.sm,
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}>
          <Sparkles size={32} style={{ color: theme.colors.primary }} />
          Document Generators
        </h1>
        <p style={{
          fontSize: theme.typography.fontSize.base,
          color: theme.colors.textMuted,
        }}>
          Generate professional documents, diagrams, and exports for your API programs
        </p>
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div style={{
          padding: theme.spacing.md,
          marginBottom: theme.spacing.lg,
          backgroundColor: `${theme.colors.danger}20`,
          border: `1px solid ${theme.colors.danger}`,
          borderRadius: theme.borders.radius.md,
          color: theme.colors.danger,
          fontSize: theme.typography.fontSize.sm,
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {successMessage && (
        <div style={{
          padding: theme.spacing.md,
          marginBottom: theme.spacing.lg,
          backgroundColor: `${theme.colors.success}20`,
          border: `1px solid ${theme.colors.success}`,
          borderRadius: theme.borders.radius.md,
          color: theme.colors.success,
          fontSize: theme.typography.fontSize.sm,
        }}>
          {successMessage}
        </div>
      )}

      {/* Stats Bar */}
      {!selectedGenerator && stats.totalGenerated > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.xl,
        }}>
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borders.radius.md,
            border: `1px solid ${theme.colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <TrendingUp size={20} style={{ color: theme.colors.success }} />
              <div>
                <div style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.textMuted,
                  textTransform: 'uppercase',
                }}>Total Generated</div>
                <div style={{
                  fontSize: theme.typography.fontSize.xl,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.text,
                }}>{stats.totalGenerated}</div>
              </div>
            </div>
          </div>
          
          {stats.lastGenerated && (
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borders.radius.md,
              border: `1px solid ${theme.colors.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <Clock size={20} style={{ color: theme.colors.info }} />
                <div>
                  <div style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.textMuted,
                    textTransform: 'uppercase',
                  }}>Last Generated</div>
                  <div style={{
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text,
                  }}>
                    {stats.lastGenerated.toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {stats.mostUsed && (
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borders.radius.md,
              border: `1px solid ${theme.colors.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <Sparkles size={20} style={{ color: theme.colors.warning }} />
                <div>
                  <div style={{
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.textMuted,
                    textTransform: 'uppercase',
                  }}>Most Used</div>
                  <div style={{
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text,
                    textTransform: 'capitalize',
                  }}>
                    {stats.mostUsed.replace('-', ' ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {!selectedGenerator ? (
        // Generator Selection Grid
        <div>
          {Object.entries(generatorsByCategory).map(([category, generators]) => (
            <div key={category} style={{ marginBottom: theme.spacing.xl }}>
              <h2 style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text,
                marginBottom: theme.spacing.md,
                textTransform: 'capitalize',
              }}>
                {category}
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: theme.spacing.lg,
              }}>
                {generators.map(generator => (
                  <GeneratorCard
                    key={generator.id}
                    generator={generator}
                    recentHistory={generatorHistory[generator.id]}
                    onSelect={() => handleGeneratorSelect(generator.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Generator Workflow
        <div style={{ display: 'grid', gridTemplateColumns: generatedDocument ? '1fr 1fr' : '1fr', gap: theme.spacing.xl }}>
          <div>
            <GeneratorForm
              generatorType={selectedGenerator}
              onSubmit={handleGeneratorSubmit}
              onCancel={handleBack}
              isGenerating={isGenerating}
            />
          </div>
          
          {generatedDocument && (
            <div>
              <GeneratorPreview
                document={generatedDocument}
                isLoading={isGenerating}
                onExport={(format) => setShowExportModal(true)}
              />
            </div>
          )}
        </div>
      )}

      {/* Export Modal */}
      {generatedDocument && (
        <GeneratorExport
          document={generatedDocument}
          onExport={handleExport}
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
};