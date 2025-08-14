import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronRight, Info, Clock, RefreshCw, Check, X, Zap, Plus } from 'lucide-react';
import { useTheme } from '../../themes/ThemeContext';

interface Operation {
  name: string;
  category?: string;
  description?: string;
  required?: boolean;
  type?: 'query' | 'mutation' | 'subscription';
}

interface OperationSelectorProps {
  operations: string[] | Operation[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  allowCustom?: boolean;
  showCategories?: boolean;
}

export const OperationSelector: React.FC<OperationSelectorProps> = ({
  operations,
  value,
  onChange,
  placeholder = "Search or select an operation...",
  error = false,
  allowCustom = true,
  showCategories = false
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Convert operations to consistent format
  const operationsList: Operation[] = operations.map(op => 
    typeof op === 'string' 
      ? { name: op } 
      : op
  );

  // Filter operations based on search term
  const filteredOperations = operationsList.filter(op =>
    op.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group operations by category if needed
  const groupedOperations = showCategories 
    ? filteredOperations.reduce((acc, op) => {
        const category = op.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(op);
        return acc;
      }, {} as Record<string, Operation[]>)
    : { 'All': filteredOperations };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    const allOps = filteredOperations;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < allOps.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (allOps[highlightedIndex]) {
          handleSelect(allOps[highlightedIndex].name);
        } else if (allowCustom && searchTerm) {
          handleSelect(searchTerm);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (operation: string) => {
    onChange(operation);
    setSearchTerm('');
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  // Get icon for operation type
  const getOperationIcon = (op: Operation) => {
    if (op.type === 'mutation') {
      return <Zap size={14} style={{ color: theme.colors.warning }} />;
    } else if (op.type === 'subscription') {
      return <RefreshCw size={14} style={{ color: theme.colors.info }} />;
    }
    return <Info size={14} style={{ color: theme.colors.primary }} />;
  };

  return (
    <div className="relative">
      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-8 rounded transition-all"
          style={{
            backgroundColor: theme.colors.surface,
            border: `1px solid ${error ? theme.colors.danger : theme.colors.border}`,
            color: theme.colors.text,
            fontSize: theme.typography.fontSize.sm
          }}
        />
        <Search 
          size={16} 
          className="absolute right-2 top-1/2 transform -translate-y-1/2"
          style={{ color: theme.colors.textMuted }}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden"
          style={{
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {/* Search Results Count */}
          {searchTerm && (
            <div 
              className="px-3 py-2 text-xs"
              style={{ 
                backgroundColor: theme.colors.background,
                color: theme.colors.textMuted,
                borderBottom: `1px solid ${theme.colors.border}`
              }}
            >
              {filteredOperations.length} operations found
              {allowCustom && filteredOperations.length === 0 && (
                <span> • Press Enter to create "{searchTerm}"</span>
              )}
            </div>
          )}

          {/* Operations List */}
          {Object.entries(groupedOperations).map(([category, ops]) => (
            <div key={category}>
              {showCategories && category !== 'All' && (
                <div 
                  className="px-3 py-1 text-xs font-semibold sticky top-0"
                  style={{ 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.textMuted,
                    borderBottom: `1px solid ${theme.colors.border}`
                  }}
                >
                  {category}
                </div>
              )}
              
              {ops.map((op, index) => {
                const globalIndex = filteredOperations.indexOf(op);
                const isHighlighted = globalIndex === highlightedIndex;
                
                return (
                  <div
                    key={op.name}
                    onClick={() => handleSelect(op.name)}
                    onMouseEnter={() => setHighlightedIndex(globalIndex)}
                    className="px-3 py-2 cursor-pointer transition-all flex items-start gap-2"
                    style={{
                      backgroundColor: isHighlighted ? theme.colors.primaryBackground : 'transparent',
                      color: isHighlighted ? theme.colors.primary : theme.colors.text
                    }}
                  >
                    <div className="mt-0.5">
                      {getOperationIcon(op)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {op.name}
                        </span>
                        {op.required && (
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
                      {op.description && (
                        <p 
                          className="text-xs mt-0.5 truncate"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          {op.description}
                        </p>
                      )}
                    </div>
                    {value === op.name && (
                      <Check size={14} style={{ color: theme.colors.success }} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* No Results */}
          {filteredOperations.length === 0 && !allowCustom && (
            <div 
              className="px-3 py-4 text-center text-sm"
              style={{ color: theme.colors.textMuted }}
            >
              No operations found
            </div>
          )}

          {/* Create Custom Option */}
          {allowCustom && searchTerm && !filteredOperations.find(op => op.name === searchTerm) && (
            <div
              onClick={() => handleSelect(searchTerm)}
              className="px-3 py-2 cursor-pointer transition-all flex items-center gap-2"
              style={{
                backgroundColor: highlightedIndex === filteredOperations.length ? theme.colors.primaryBackground : 'transparent',
                color: highlightedIndex === filteredOperations.length ? theme.colors.primary : theme.colors.text,
                borderTop: `1px solid ${theme.colors.border}`
              }}
            >
              <Plus size={14} />
              <span className="text-sm">Create custom operation: "{searchTerm}"</span>
            </div>
          )}

          {/* Keyboard Shortcuts Hint */}
          <div 
            className="px-3 py-2 text-xs flex items-center justify-between"
            style={{ 
              backgroundColor: theme.colors.background,
              color: theme.colors.textMuted,
              borderTop: `1px solid ${theme.colors.border}`
            }}
          >
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Preset operation templates for common workflows
export const OPERATION_TEMPLATES = {
  payment: [
    { name: 'initiate_payment', description: 'Start a new payment transaction', type: 'mutation' as const },
    { name: 'verify_payment', description: 'Verify payment status', type: 'query' as const },
    { name: 'capture_payment', description: 'Capture authorized payment', type: 'mutation' as const },
    { name: 'refund_payment', description: 'Process payment refund', type: 'mutation' as const },
  ],
  card: [
    { name: 'create_card', description: 'Issue a new card', type: 'mutation' as const },
    { name: 'activate_card', description: 'Activate issued card', type: 'mutation' as const },
    { name: 'block_card', description: 'Block card for security', type: 'mutation' as const },
    { name: 'get_card_details', description: 'Retrieve card information', type: 'query' as const },
  ],
  account: [
    { name: 'create_account', description: 'Create new account', type: 'mutation' as const },
    { name: 'get_balance', description: 'Check account balance', type: 'query' as const },
    { name: 'update_limits', description: 'Update account limits', type: 'mutation' as const },
    { name: 'close_account', description: 'Close account', type: 'mutation' as const },
  ],
  kyc: [
    { name: 'submit_documents', description: 'Submit KYC documents', type: 'mutation' as const },
    { name: 'verify_identity', description: 'Verify user identity', type: 'mutation' as const },
    { name: 'check_status', description: 'Check verification status', type: 'query' as const },
    { name: 'update_information', description: 'Update KYC information', type: 'mutation' as const },
  ]
};