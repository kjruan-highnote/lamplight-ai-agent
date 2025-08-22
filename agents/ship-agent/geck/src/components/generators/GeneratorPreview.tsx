import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../../themes/ThemeContext';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { GeneratedDocument, GeneratorPreviewData } from '../../lib/generators/types';
import { Eye, Code, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';

interface GeneratorPreviewProps {
  document: GeneratedDocument | null;
  previewData?: GeneratorPreviewData;
  isLoading?: boolean;
  onExport?: (format: string) => void;
}

export const GeneratorPreview: React.FC<GeneratorPreviewProps> = ({
  document,
  previewData,
  isLoading = false,
  onExport,
}) => {
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <Card variant="default" padding="lg">
        <CardContent>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
          }}>
            <div className="animate-pulse" style={{
              width: '100%',
              maxWidth: '600px',
            }}>
              <div style={{
                height: '20px',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borders.radius.sm,
                marginBottom: theme.spacing.md,
              }} />
              <div style={{
                height: '16px',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borders.radius.sm,
                marginBottom: theme.spacing.sm,
                width: '80%',
              }} />
              <div style={{
                height: '16px',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borders.radius.sm,
                marginBottom: theme.spacing.sm,
                width: '90%',
              }} />
              <div style={{
                height: '16px',
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borders.radius.sm,
                width: '70%',
              }} />
            </div>
            <p style={{
              marginTop: theme.spacing.xl,
              color: theme.colors.textMuted,
              fontSize: theme.typography.fontSize.sm,
            }}>
              Generating document...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!document && !previewData) {
    return (
      <Card variant="default" padding="lg">
        <CardContent>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            color: theme.colors.textMuted,
          }}>
            <FileText size={48} style={{ marginBottom: theme.spacing.md }} />
            <p>No preview available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = document?.content || previewData?.content || '';
  const sections = previewData?.sections || [];

  return (
    <Card variant="default" padding="lg">
      <CardContent>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          borderBottom: `1px solid ${theme.colors.border}`,
        }}>
          <div>
            {document && (
              <>
                <h3 style={{
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.text,
                  marginBottom: theme.spacing.xs,
                }}>
                  {document.title}
                </h3>
                <p style={{
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.textMuted,
                }}>
                  Generated {new Date(document.metadata.generatedAt).toLocaleString()}
                </p>
              </>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: theme.spacing.sm }}>
            {/* View Mode Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: theme.colors.surface,
              borderRadius: theme.borders.radius.md,
              padding: '2px',
            }}>
              <Button
                variant={viewMode === 'preview' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('preview')}
                style={{ borderRadius: theme.borders.radius.sm }}
              >
                <Eye size={16} style={{ marginRight: theme.spacing.xs }} />
                Preview
              </Button>
              <Button
                variant={viewMode === 'source' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('source')}
                style={{ borderRadius: theme.borders.radius.sm }}
              >
                <Code size={16} style={{ marginRight: theme.spacing.xs }} />
                Source
              </Button>
            </div>

            {/* Export Options */}
            {document?.exports && document.exports.length > 0 && onExport && (
              <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                {document.exports.map(exp => {
                  if (!exp || !exp.format) return null;
                  return (
                    <Button
                      key={exp.format}
                      variant="secondary"
                      size="sm"
                      onClick={() => onExport(exp.format)}
                    >
                      Export as {String(exp.format || 'unknown').toUpperCase()}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Section Navigation (if available) */}
        {sections.length > 0 && viewMode === 'preview' && (
          <div style={{
            marginBottom: theme.spacing.lg,
            padding: theme.spacing.md,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borders.radius.md,
          }}>
            <h4 style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.text,
              marginBottom: theme.spacing.sm,
            }}>
              Sections
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => toggleSection(section.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    backgroundColor: theme.colors.background,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borders.radius.sm,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.surface;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.background;
                  }}
                >
                  <span style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.text,
                  }}>
                    {section.title}
                  </span>
                  {collapsedSections.has(section.id) ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronUp size={16} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{
          minHeight: '400px',
          maxHeight: '600px',
          overflowY: 'auto',
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borders.radius.md,
        }}>
          {viewMode === 'preview' ? (
            <div className="markdown-content" style={{
              color: theme.colors.text,
              lineHeight: 1.6,
            }}>
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({children}) => (
                    <h1 style={{
                      fontSize: theme.typography.fontSize['2xl'],
                      fontWeight: theme.typography.fontWeight.bold,
                      marginTop: theme.spacing.lg,
                      marginBottom: theme.spacing.md,
                      color: theme.colors.text,
                    }}>{children}</h1>
                  ),
                  h2: ({children}) => (
                    <h2 style={{
                      fontSize: theme.typography.fontSize.xl,
                      fontWeight: theme.typography.fontWeight.semibold,
                      marginTop: theme.spacing.lg,
                      marginBottom: theme.spacing.md,
                      color: theme.colors.text,
                    }}>{children}</h2>
                  ),
                  h3: ({children}) => (
                    <h3 style={{
                      fontSize: theme.typography.fontSize.lg,
                      fontWeight: theme.typography.fontWeight.semibold,
                      marginTop: theme.spacing.md,
                      marginBottom: theme.spacing.sm,
                      color: theme.colors.text,
                    }}>{children}</h3>
                  ),
                  p: ({children}) => (
                    <p style={{
                      marginBottom: theme.spacing.md,
                      color: theme.colors.text,
                    }}>{children}</p>
                  ),
                  ul: ({children}) => (
                    <ul style={{
                      marginLeft: theme.spacing.lg,
                      marginBottom: theme.spacing.md,
                    }}>{children}</ul>
                  ),
                  li: ({children}) => (
                    <li style={{
                      marginBottom: theme.spacing.xs,
                      color: theme.colors.text,
                    }}>{children}</li>
                  ),
                  code: ({inline, children}: any) => (
                    inline ? (
                      <code style={{
                        padding: `2px ${theme.spacing.xs}`,
                        backgroundColor: theme.colors.background,
                        borderRadius: theme.borders.radius.sm,
                        fontFamily: theme.typography.fontFamily.mono,
                        fontSize: '0.9em',
                        color: theme.colors.primary,
                      }}>{children}</code>
                    ) : (
                      <pre style={{
                        padding: theme.spacing.md,
                        backgroundColor: theme.colors.background,
                        borderRadius: theme.borders.radius.md,
                        overflowX: 'auto',
                        marginBottom: theme.spacing.md,
                      }}>
                        <code style={{
                          fontFamily: theme.typography.fontFamily.mono,
                          fontSize: theme.typography.fontSize.sm,
                          color: theme.colors.text,
                        }}>{children}</code>
                      </pre>
                    )
                  ),
                  blockquote: ({children}) => (
                    <blockquote style={{
                      borderLeft: `4px solid ${theme.colors.primary}`,
                      paddingLeft: theme.spacing.md,
                      marginLeft: 0,
                      marginBottom: theme.spacing.md,
                      color: theme.colors.textMuted,
                    }}>{children}</blockquote>
                  ),
                  table: ({children}) => (
                    <div style={{ overflowX: 'auto', marginBottom: theme.spacing.md }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                      }}>{children}</table>
                    </div>
                  ),
                  th: ({children}) => (
                    <th style={{
                      padding: theme.spacing.sm,
                      borderBottom: `2px solid ${theme.colors.border}`,
                      textAlign: 'left',
                      fontWeight: theme.typography.fontWeight.semibold,
                      color: theme.colors.text,
                    }}>{children}</th>
                  ),
                  td: ({children}) => (
                    <td style={{
                      padding: theme.spacing.sm,
                      borderBottom: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text,
                    }}>{children}</td>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <MonacoEditor
              height="500px"
              language="markdown"
              theme={theme.isDark ? 'vs-dark' : 'light'}
              value={content}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};