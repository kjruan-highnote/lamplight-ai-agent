import React, { useState, useEffect } from 'react';
import { 
  Sparkles, AlertCircle, CheckCircle, RefreshCw, 
  ArrowRight, Info, Zap, X, ChevronDown, ChevronRight 
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { VaultButton } from '../VaultButton';
import { useTheme } from '../../themes/ThemeContext';
import { api } from '../../lib/api';
import { SchemaInputDisplay } from '../operation/SchemaInputDisplay';

interface EnrichOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  endpoint?: string;
  onSuccess?: () => void;
}

interface EnrichmentProgress {
  total: number;
  processed: number;
  enriched: number;
  failed: number;
  skipped: number;
  currentOperation?: string;
  errors: Array<{ operation: string; error: string }>;
}

export const EnrichOperationsModal: React.FC<EnrichOperationsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  endpoint = 'https://api.us.test.highnote.com/graphql',
  onSuccess
}) => {
  const { theme } = useTheme();
  const [step, setStep] = useState<'preview' | 'confirm' | 'processing' | 'complete'>('preview');
  const [loading, setLoading] = useState(false);
  const [exampleOperation, setExampleOperation] = useState<any>(null);
  const [exampleEnriched, setExampleEnriched] = useState<any>(null);
  const [progress, setProgress] = useState<EnrichmentProgress>({
    total: 0,
    processed: 0,
    enriched: 0,
    failed: 0,
    skipped: 0,
    errors: []
  });
  const [showExample, setShowExample] = useState(true);
  const [operationsList, setOperationsList] = useState<any[]>([]);
  const [forceRefresh, setForceRefresh] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPreview();
      setForceRefresh(false); // Reset force refresh when modal opens
    }
  }, [isOpen]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      // Get ALL operations by using a large pageSize
      const result = await api.operations.list({ pageSize: 1000 });
      let operations: any[] = [];
      
      if (Array.isArray(result)) {
        operations = result;
      } else if (result && typeof result === 'object' && 'data' in result) {
        if (Array.isArray(result.data)) {
          operations = result.data;
        } else if (result.data && typeof result.data === 'object') {
          // If data is grouped by category, flatten it
          operations = Object.values(result.data).flat();
        }
      }
      
      setOperationsList(operations);

      // Find a good example operation (preferably a mutation with variables)
      const exampleOp = operations.find(op => 
        op.type === 'mutation' && op.variables && Object.keys(op.variables).length > 0
      ) || operations[0];

      if (exampleOp) {
        setExampleOperation(exampleOp);
        
        // Get enriched version of the example using the new batch endpoint
        try {
          const response = await fetch('/.netlify/functions/enrich-by-types', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              apiKey,
              endpoint,
              operations: [exampleOp]
            })
          });
          
          if (response.ok) {
            const enrichedResult = await response.json();
            
            if (enrichedResult.success && enrichedResult.enrichedOperations) {
              const key = exampleOp._id || exampleOp.name;
              const enrichedData = enrichedResult.enrichedOperations[key];
              
              if (enrichedData && enrichedData.inputs) {
                // Structure the inputs properly for display
                const structuredInputs: Record<string, any> = {};
                
                for (const [typeName, typeData] of Object.entries(enrichedData.inputs as Record<string, any>)) {
                  if (typeData && typeof typeData === 'object') {
                    const data = typeData as any;
                    if (data.fields) {
                      // Store the fields with their metadata
                      structuredInputs[data.actualTypeName || typeName] = data.fields;
                    }
                  }
                }
                
                setExampleEnriched({
                  ...exampleOp,
                  schemaInputs: structuredInputs
                });
              }
            }
          }
        } catch (error) {
          console.error('Failed to enrich example:', error);
        }
      }

      setProgress(prev => ({
        ...prev,
        total: operations.length
      }));
    } catch (error) {
      console.error('Failed to load preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEnrichment = async () => {
    setStep('processing');
    setProgress(prev => ({ ...prev, processed: 0, enriched: 0, failed: 0, skipped: 0, errors: [] }));

    try {
      // Filter operations based on force refresh setting
      const operationsToEnrich = forceRefresh 
        ? operationsList // Enrich all operations when force refresh is enabled
        : operationsList.filter(op => 
            !op.schemaInputs || Object.keys(op.schemaInputs).length === 0
          );

      if (operationsToEnrich.length === 0) {
        setProgress(prev => ({
          ...prev,
          processed: operationsList.length,
          skipped: operationsList.length
        }));
        setStep('complete');
        return;
      }

      setProgress(prev => ({
        ...prev,
        currentOperation: 'Fetching schema and enriching all operations...'
      }));

      // Call the batch enrichment endpoint with all operations at once
      const response = await fetch('/.netlify/functions/enrich-by-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          endpoint,
          operations: operationsToEnrich
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.enrichedOperations) {
        // Update each enriched operation
        const updatePromises = [];
        
        for (const [key, enrichedData] of Object.entries(result.enrichedOperations as Record<string, any>)) {
          const operation = operationsToEnrich.find(op => op._id === key || op.name === key);
          if (operation && enrichedData.inputs) {
            // Structure the inputs the same way as individual enrichment
            const schemaInputs: Record<string, any> = {};
            
            for (const [typeName, typeData] of Object.entries(enrichedData.inputs as Record<string, any>)) {
              if (typeof typeData === 'object' && typeData !== null) {
                const typeInfo = typeData as any;
                if (typeInfo.fields) {
                  // Ensure all fields have proper structure
                  const processedFields: Record<string, any> = {};
                  for (const [fieldName, fieldData] of Object.entries(typeInfo.fields)) {
                    if (typeof fieldData === 'object' && fieldData !== null) {
                      const field = fieldData as any;
                      // Ensure each field has at least name and type
                      processedFields[fieldName] = {
                        ...field,
                        name: field.name || fieldName,
                        type: field.type || 'String'
                      };
                    }
                  }
                  
                  // Create a properly structured input parameter - same as individual enrichment
                  schemaInputs.input = {
                    name: 'input',
                    type: typeInfo.actualTypeName || typeName,
                    required: true,
                    description: typeInfo.description || `Input of type ${typeName}`,
                    fields: processedFields
                  };
                  break; // We only handle the first input type for now
                }
              }
            }
            
            if (Object.keys(schemaInputs).length > 0) {
              updatePromises.push(
                api.operations.update(operation._id!, {
                  schemaInputs: schemaInputs,
                  schemaVersion: new Date().toISOString(),
                  source: 'schema-introspection'
                })
              );
            }
          }
        }

        // Execute all updates
        await Promise.all(updatePromises);

        // Update progress based on results
        const enrichedCount = Object.keys(result.enrichedOperations).length;
        const skippedCount = forceRefresh ? 0 : operationsList.length - operationsToEnrich.length;
        const failedCount = operationsToEnrich.length - enrichedCount;

        setProgress({
          total: operationsList.length,
          processed: operationsList.length,
          enriched: enrichedCount,
          skipped: skippedCount,
          failed: failedCount,
          errors: result.errors ? result.errors.map((err: string) => ({
            operation: err.split(':')[0] || 'Unknown',
            error: err
          })) : []
        });
      } else {
        throw new Error(result.error || 'Failed to enrich operations');
      }
    } catch (error: any) {
      console.error('Batch enrichment failed:', error);
      setProgress(prev => ({
        ...prev,
        processed: prev.total,
        failed: prev.total - prev.enriched - prev.skipped,
        errors: [{
          operation: 'Batch Enrichment',
          error: error.message || 'Unknown error'
        }]
      }));
    }

    setStep('complete');
    if (onSuccess) {
      onSuccess();
    }
  };

  const getProgressPercentage = () => {
    if (progress.total === 0) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  };

  const renderContent = () => {
    switch (step) {
      case 'preview':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg" style={{
              backgroundColor: `${theme.colors.info}10`,
              border: `1px solid ${theme.colors.info}30`
            }}>
              <Info size={20} style={{ color: theme.colors.info }} className="mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-1">Schema Enrichment</p>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  This will fetch the latest GraphQL schema from Highnote and enrich all operations with detailed input type information.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                    <strong>{operationsList.length}</strong> total operations found
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                    {forceRefresh 
                      ? `All ${operationsList.length} operations will be refreshed`
                      : `${operationsList.filter(op => !op.schemaInputs || Object.keys(op.schemaInputs).length === 0).length} operations need enrichment`
                    }
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg transition-colors" 
                    style={{ 
                      backgroundColor: forceRefresh ? `${theme.colors.warning}20` : theme.colors.surface,
                      border: `1px solid ${forceRefresh ? theme.colors.warning : theme.colors.border}`
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={forceRefresh}
                      onChange={(e) => setForceRefresh(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm font-medium" style={{ 
                      color: forceRefresh ? theme.colors.warning : theme.colors.text 
                    }}>
                      Force refresh all
                    </span>
                    <RefreshCw size={14} style={{ 
                      color: forceRefresh ? theme.colors.warning : theme.colors.textMuted 
                    }} />
                  </label>
                </div>
              </div>
              
              {forceRefresh && (
                <div className="flex items-start gap-2 p-3 rounded-lg" style={{
                  backgroundColor: `${theme.colors.warning}10`,
                  border: `1px solid ${theme.colors.warning}30`
                }}>
                  <AlertCircle size={16} style={{ color: theme.colors.warning }} className="mt-0.5 flex-shrink-0" />
                  <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                    Force refresh will re-fetch schema data for all operations, including those already enriched. 
                    This is useful when the GraphQL schema has been updated.
                  </p>
                </div>
              )}
            </div>

            {exampleOperation && exampleEnriched && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowExample(!showExample)}
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: theme.colors.primary }}
                >
                  {showExample ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  Example Transformation
                </button>

                {showExample && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>
                        Before Enrichment
                      </h4>
                      <div className="p-3 rounded-lg" style={{
                        backgroundColor: theme.colors.surface,
                        border: `1px solid ${theme.colors.border}`
                      }}>
                        <p className="font-mono text-sm mb-2">{exampleOperation.name}</p>
                        {exampleOperation.variables && (
                          <div className="space-y-1">
                            {Object.entries(exampleOperation.variables).map(([key, var_]: any) => (
                              <div key={key} className="text-xs">
                                <span style={{ color: theme.colors.primary }}>${var_.name}</span>
                                <span style={{ color: theme.colors.textMuted }}> : {var_.type}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold mb-2" style={{ color: theme.colors.success }}>
                        After Enrichment
                      </h4>
                      <div className="p-3 rounded-lg" style={{
                        backgroundColor: theme.colors.surface,
                        border: `1px solid ${theme.colors.success}30`
                      }}>
                        <p className="font-mono text-sm mb-2">{exampleEnriched.name}</p>
                        <div className="text-xs space-y-2">
                          {Object.entries(exampleEnriched.schemaInputs).map(([typeName, fields]: any) => (
                            <div key={typeName}>
                              <div className="mb-1">
                                <span style={{ color: theme.colors.warning }}>Type: </span>
                                <span style={{ color: theme.colors.primary }}>{typeName}</span>
                              </div>
                              {fields && typeof fields === 'object' && (
                                <div className="ml-3 space-y-0.5">
                                  {Object.entries(fields).slice(0, 3).map(([fieldName, field]: any) => (
                                    <div key={fieldName}>
                                      <span style={{ color: theme.colors.textSecondary }}>→ {field.name || fieldName}</span>
                                      <span style={{ color: theme.colors.textMuted }}> : {field.type || 'any'}</span>
                                      {field.required && <span className="text-red-400 ml-1">*</span>}
                                    </div>
                                  ))}
                                  {Object.keys(fields).length > 3 && (
                                    <div style={{ color: theme.colors.textMuted }}>
                                      → ...and {Object.keys(fields).length - 3} more fields
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg" style={{
              backgroundColor: `${theme.colors.warning}10`,
              border: `1px solid ${theme.colors.warning}30`
            }}>
              <AlertCircle size={20} style={{ color: theme.colors.warning }} className="mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-1">Confirm Enrichment</p>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  This operation will make multiple API calls and may take several minutes to complete.
                  {forceRefresh && ' All operations will be refreshed, including those already enriched.'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {forceRefresh && (
                <div className="flex items-center justify-between p-3 rounded-lg" style={{
                  backgroundColor: `${theme.colors.warning}20`,
                  border: `1px solid ${theme.colors.warning}`
                }}>
                  <span className="text-sm flex items-center gap-2">
                    <RefreshCw size={16} style={{ color: theme.colors.warning }} />
                    Force Refresh Mode
                  </span>
                  <span className="font-semibold" style={{ color: theme.colors.warning }}>ENABLED</span>
                </div>
              )}
              <div className="flex items-center justify-between p-3 rounded-lg" style={{
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`
              }}>
                <span className="text-sm">Operations to Process</span>
                <span className="font-semibold">
                  {forceRefresh 
                    ? operationsList.length 
                    : operationsList.filter(op => !op.schemaInputs || Object.keys(op.schemaInputs).length === 0).length
                  }
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`
              }}>
                <span className="text-sm">Estimated Time</span>
                <span className="font-semibold">
                  {Math.ceil(operationsList.length / 5)} - {Math.ceil(operationsList.length / 3)} minutes
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`
              }}>
                <span className="text-sm">API Endpoint</span>
                <span className="font-mono text-xs">{endpoint}</span>
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: theme.colors.textMuted }}>
              You can close this modal and the enrichment will continue in the background
            </p>
          </div>
        );

      case 'processing':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-4">
              <RefreshCw size={48} className="animate-spin" style={{ color: theme.colors.primary }} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Progress</span>
                <span className="text-sm font-mono">{getProgressPercentage()}%</span>
              </div>
              
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${getProgressPercentage()}%`,
                    backgroundColor: theme.colors.primary
                  }}
                />
              </div>

              {progress.currentOperation && (
                <p className="text-xs text-center" style={{ color: theme.colors.textMuted }}>
                  Processing: {progress.currentOperation}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="text-center p-2 rounded" style={{ backgroundColor: theme.colors.surface }}>
                  <p className="text-2xl font-bold" style={{ color: theme.colors.success }}>
                    {progress.enriched}
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.textMuted }}>Enriched</p>
                </div>
                <div className="text-center p-2 rounded" style={{ backgroundColor: theme.colors.surface }}>
                  <p className="text-2xl font-bold" style={{ color: theme.colors.info }}>
                    {progress.skipped}
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.textMuted }}>Skipped</p>
                </div>
              </div>

              {progress.failed > 0 && (
                <div className="text-center p-2 rounded" style={{ 
                  backgroundColor: `${theme.colors.danger}10`,
                  border: `1px solid ${theme.colors.danger}30`
                }}>
                  <p className="text-lg font-bold" style={{ color: theme.colors.danger }}>
                    {progress.failed}
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.textMuted }}>Failed</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-4">
              <CheckCircle size={48} style={{ color: theme.colors.success }} />
            </div>

            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Enrichment Complete!</h3>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Successfully processed {progress.total} operations
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg" style={{ 
                backgroundColor: `${theme.colors.success}10`,
                border: `1px solid ${theme.colors.success}30`
              }}>
                <p className="text-2xl font-bold" style={{ color: theme.colors.success }}>
                  {progress.enriched}
                </p>
                <p className="text-xs">Enriched</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ 
                backgroundColor: `${theme.colors.info}10`,
                border: `1px solid ${theme.colors.info}30`
              }}>
                <p className="text-2xl font-bold" style={{ color: theme.colors.info }}>
                  {progress.skipped}
                </p>
                <p className="text-xs">Skipped</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ 
                backgroundColor: `${theme.colors.danger}10`,
                border: `1px solid ${theme.colors.danger}30`
              }}>
                <p className="text-2xl font-bold" style={{ color: theme.colors.danger }}>
                  {progress.failed}
                </p>
                <p className="text-xs">Failed</p>
              </div>
            </div>

            {progress.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold mb-2" style={{ color: theme.colors.danger }}>
                  Failed Operations:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {progress.errors.map((error, index) => (
                    <div key={index} className="text-xs p-2 rounded" style={{
                      backgroundColor: theme.colors.surface,
                      border: `1px solid ${theme.colors.border}`
                    }}>
                      <span className="font-mono">{error.operation}</span>
                      <span style={{ color: theme.colors.textMuted }}> - {error.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  const getModalTitle = () => {
    switch (step) {
      case 'preview': return 'Enrich All Operations';
      case 'confirm': return 'Confirm Enrichment';
      case 'processing': return 'Enriching Operations...';
      case 'complete': return 'Enrichment Complete';
      default: return 'Enrich Operations';
    }
  };

  const getActionButtons = () => {
    switch (step) {
      case 'preview':
        return (
          <>
            <VaultButton variant="ghost" onClick={onClose}>
              Cancel
            </VaultButton>
            <VaultButton 
              variant="primary" 
              onClick={() => setStep('confirm')}
              disabled={loading || operationsList.length === 0}
            >
              <ArrowRight size={16} />
              Continue
            </VaultButton>
          </>
        );
      case 'confirm':
        return (
          <>
            <VaultButton variant="ghost" onClick={() => setStep('preview')}>
              Back
            </VaultButton>
            <VaultButton 
              variant="primary" 
              onClick={handleStartEnrichment}
            >
              <Sparkles size={16} />
              Start Enrichment
            </VaultButton>
          </>
        );
      case 'processing':
        return (
          <VaultButton variant="ghost" onClick={onClose}>
            Run in Background
          </VaultButton>
        );
      case 'complete':
        return (
          <VaultButton variant="primary" onClick={onClose}>
            Done
          </VaultButton>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={step !== 'processing' ? onClose : () => {}}
      title={getModalTitle()}
      size="lg"
    >
      <div className="py-4">
        {loading && step === 'preview' ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={32} className="animate-spin" style={{ color: theme.colors.primary }} />
          </div>
        ) : (
          renderContent()
        )}
      </div>
      
      <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: theme.colors.border }}>
        {getActionButtons()}
      </div>
    </Modal>
  );
};