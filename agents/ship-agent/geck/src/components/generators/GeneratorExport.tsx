import React, { useState } from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ExportFormat, GeneratedDocument } from '../../lib/generators/types';
import { Download, FileText, FileCode, FilePlus, CheckCircle, AlertCircle } from 'lucide-react';

interface GeneratorExportProps {
  document: GeneratedDocument;
  onExport: (format: ExportFormat) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

interface ExportStatus {
  format: ExportFormat;
  status: 'idle' | 'exporting' | 'success' | 'error';
  message?: string;
}

export const GeneratorExport: React.FC<GeneratorExportProps> = ({
  document,
  onExport,
  isOpen,
  onClose,
}) => {
  const { theme } = useTheme();
  const [exportStatuses, setExportStatuses] = useState<Partial<Record<ExportFormat, ExportStatus>>>({});
  const [selectedFormats, setSelectedFormats] = useState<Set<ExportFormat>>(new Set<ExportFormat>(['markdown']));

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'markdown':
        return <FileText size={20} />;
      case 'html':
        return <FileCode size={20} />;
      case 'pdf':
        return <FileText size={20} />;
      case 'docx':
        return <FilePlus size={20} />;
      case 'confluence':
        return <FileCode size={20} />;
      case 'json':
        return <FileCode size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  const getFormatDescription = (format: ExportFormat) => {
    switch (format) {
      case 'markdown':
        return 'Plain text with formatting syntax';
      case 'html':
        return 'Web-ready HTML document';
      case 'pdf':
        return 'Portable Document Format';
      case 'docx':
        return 'Microsoft Word document';
      case 'confluence':
        return 'Confluence wiki markup';
      case 'json':
        return 'JSON data format';
      default:
        return 'Document format';
    }
  };

  const toggleFormat = (format: ExportFormat) => {
    setSelectedFormats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(format)) {
        newSet.delete(format);
      } else {
        newSet.add(format);
      }
      return newSet;
    });
  };

  const handleExportAll = async () => {
    const formats = Array.from(selectedFormats);
    
    // Reset statuses
    const initialStatuses: Record<string, ExportStatus> = {};
    formats.forEach(format => {
      initialStatuses[format] = { format, status: 'exporting' };
    });
    setExportStatuses(initialStatuses as any);

    // Export each format
    for (const format of formats) {
      try {
        await onExport(format);
        setExportStatuses(prev => ({
          ...prev,
          [format]: { format, status: 'success', message: 'Export successful' }
        }));
      } catch (error) {
        setExportStatuses(prev => ({
          ...prev,
          [format]: { format, status: 'error', message: 'Export failed' }
        }));
      }
    }
  };

  const handleDownload = (format: ExportFormat) => {
    const exportData = document.exports.find(e => e.format === format);
    if (exportData) {
      // Create a download link
      const link = window.document.createElement('a');
      link.href = exportData.url;
      link.download = `${document.title}.${format}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Document">
      <div style={{ padding: theme.spacing.lg }}>
        {/* Document Info */}
        <div style={{
          marginBottom: theme.spacing.xl,
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borders.radius.md,
        }}>
          <h3 style={{
            fontSize: theme.typography.fontSize.base,
            fontWeight: theme.typography.fontWeight.semibold,
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
        </div>

        {/* Format Selection */}
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h4 style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text,
            marginBottom: theme.spacing.md,
          }}>
            Select Export Formats
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {(document.exports || []).map(exp => {
              if (!exp || !exp.format) return null;
              const status = exportStatuses[exp.format];
              const isSelected = selectedFormats.has(exp.format);
              
              return (
                <div
                  key={exp.format}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: theme.spacing.md,
                    backgroundColor: isSelected ? theme.colors.primary + '10' : theme.colors.background,
                    border: `1px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: theme.borders.radius.md,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => toggleFormat(exp.format)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ marginRight: theme.spacing.md }}
                  />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      {getFormatIcon(exp.format)}
                      <div>
                        <div style={{
                          fontSize: theme.typography.fontSize.sm,
                          fontWeight: theme.typography.fontWeight.medium,
                          color: theme.colors.text,
                          textTransform: 'uppercase',
                        }}>
                          {String(exp.format || 'unknown')}
                        </div>
                        <div style={{
                          fontSize: theme.typography.fontSize.xs,
                          color: theme.colors.textMuted,
                        }}>
                          {getFormatDescription(exp.format)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                    {status && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
                        {status.status === 'exporting' && (
                          <div className="animate-spin">
                            <Download size={16} />
                          </div>
                        )}
                        {status.status === 'success' && (
                          <CheckCircle size={16} style={{ color: theme.colors.success }} />
                        )}
                        {status.status === 'error' && (
                          <AlertCircle size={16} style={{ color: theme.colors.danger }} />
                        )}
                        {status.message && (
                          <span style={{
                            fontSize: theme.typography.fontSize.xs,
                            color: status.status === 'error' ? theme.colors.danger : theme.colors.textMuted,
                          }}>
                            {status.message}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <span style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.textMuted,
                    }}>
                      {exp.size ? `${(exp.size / 1024).toFixed(1)} KB` : 'N/A'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Download Links */}
        {document.exports && document.exports.length > 0 && (
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
              Quick Download
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {document.exports.map(exp => {
                if (!exp || !exp.format) return null;
                return (
                  <Button
                    key={exp.format}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDownload(exp.format)}
                  >
                    <Download size={14} style={{ marginRight: theme.spacing.xs }} />
                    {String(exp.format).toUpperCase()}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: theme.spacing.md,
          paddingTop: theme.spacing.lg,
          borderTop: `1px solid ${theme.colors.border}`,
        }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button 
            variant="primary" 
            onClick={handleExportAll}
            disabled={selectedFormats.size === 0}
          >
            <Download size={16} style={{ marginRight: theme.spacing.xs }} />
            Export Selected ({selectedFormats.size})
          </Button>
        </div>
      </div>
    </Modal>
  );
};