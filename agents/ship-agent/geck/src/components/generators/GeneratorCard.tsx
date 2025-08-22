import React from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { GeneratorMetadata, GeneratorHistoryItem } from '../../lib/generators/types';
import { Clock, FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface GeneratorCardProps {
  generator: GeneratorMetadata;
  recentHistory?: GeneratorHistoryItem[];
  onSelect: () => void;
  disabled?: boolean;
}

export const GeneratorCard: React.FC<GeneratorCardProps> = ({
  generator,
  recentHistory,
  onSelect,
  disabled = false,
}) => {
  const { theme } = useTheme();

  const getStatusIcon = (status: GeneratorHistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={14} style={{ color: theme.colors.success }} />;
      case 'generating':
        return <Clock size={14} style={{ color: theme.colors.warning }} />;
      case 'error':
        return <AlertCircle size={14} style={{ color: theme.colors.danger }} />;
      default:
        return <FileText size={14} style={{ color: theme.colors.textMuted }} />;
    }
  };

  const getCategoryColor = () => {
    switch (generator.category) {
      case 'documents':
        return theme.colors.primary;
      case 'diagrams':
        return theme.colors.info;
      case 'exports':
        return theme.colors.success;
      default:
        return theme.colors.text;
    }
  };

  return (
    <Card 
      variant="default" 
      padding="lg"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
      onClick={disabled ? undefined : onSelect}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = theme.effects.shadow.lg;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <CardContent style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ marginBottom: theme.spacing.md }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.sm
          }}>
            <span style={{ fontSize: '2rem' }}>{generator.icon}</span>
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: getCategoryColor(),
              textTransform: 'uppercase',
              fontWeight: theme.typography.fontWeight.semibold,
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderRadius: theme.borders.radius.sm,
            }}>
              {generator.category}
            </span>
          </div>
          
          <h3 style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text,
            marginBottom: theme.spacing.xs,
          }}>
            {generator.name}
          </h3>
          
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textMuted,
            lineHeight: 1.5,
          }}>
            {generator.description}
          </p>
        </div>

        {/* Export Formats */}
        <div style={{ marginBottom: theme.spacing.md }}>
          <p style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.textMuted,
            marginBottom: theme.spacing.xs,
          }}>
            Export formats:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {generator.exportFormats.map(format => (
              <span
                key={format}
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  padding: `2px ${theme.spacing.xs}`,
                  backgroundColor: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borders.radius.sm,
                  color: theme.colors.text,
                }}
              >
                {String(format || '').toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Recent History */}
        {recentHistory && recentHistory.length > 0 && (
          <div style={{ 
            flex: 1,
            marginBottom: theme.spacing.md,
            minHeight: 0,
          }}>
            <p style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.textMuted,
              marginBottom: theme.spacing.xs,
            }}>
              Recent:
            </p>
            <div style={{ 
              maxHeight: '80px',
              overflowY: 'auto',
            }}>
              {recentHistory.slice(0, 3).map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    padding: `${theme.spacing.xs} 0`,
                    borderBottom: `1px solid ${theme.colors.border}`,
                    fontSize: theme.typography.fontSize.xs,
                  }}
                >
                  {getStatusIcon(item.status)}
                  <span style={{ 
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: theme.colors.text,
                  }}>
                    {item.title}
                  </span>
                  <span style={{ color: theme.colors.textMuted }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          disabled={disabled}
          variant="primary"
          style={{
            width: '100%',
            marginTop: 'auto',
          }}
        >
          Generate {generator.name}
        </Button>
      </CardContent>
    </Card>
  );
};