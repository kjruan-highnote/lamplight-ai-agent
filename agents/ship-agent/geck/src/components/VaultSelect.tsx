import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface VaultSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }> | string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const VaultSelect: React.FC<VaultSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Convert string array to option objects if needed
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' 
      ? { value: opt, label: opt }
      : opt
  );

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setHoveredIndex(-1);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-2.5 
          bg-black/50 
          border-2 border-vault-green/50 
          text-vault-green 
          font-terminal text-sm
          flex items-center justify-between
          transition-all duration-200
          ${!disabled && 'hover:border-vault-green hover:bg-vault-green/10 hover:shadow-lg hover:shadow-vault-green/20'}
          ${disabled && 'opacity-50 cursor-not-allowed'}
          ${isOpen && 'border-vault-green bg-vault-green/10 shadow-lg shadow-vault-green/20'}
          focus:outline-none focus:border-vault-green focus:shadow-lg focus:shadow-vault-green/30
        `}
      >
        <span className={`${!selectedOption && 'text-vault-green/50'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center space-x-1">
          <span className="text-vault-green/30">|</span>
          {isOpen ? (
            <ChevronUp size={16} className="text-vault-green animate-pulse" />
          ) : (
            <ChevronDown size={16} className="text-vault-green/70" />
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`
          absolute z-50 w-full mt-1
          bg-black/95 
          border-2 border-vault-green
          shadow-2xl shadow-vault-green/30
          animate-in fade-in slide-in-from-top-1 duration-200
        `}>
          {/* Terminal header */}
          <div className="px-3 py-1 border-b border-vault-green/30 bg-vault-green/5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-vault-green/70 font-terminal">SELECT OPTION</span>
              <span className="text-xs text-vault-green/50">[{normalizedOptions.length}]</span>
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-vault-green/30 scrollbar-track-transparent">
            {normalizedOptions.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(-1)}
                className={`
                  w-full px-3 py-2 text-left
                  font-terminal text-sm
                  transition-all duration-100
                  flex items-center justify-between
                  ${option.value === value 
                    ? 'bg-vault-green/20 text-vault-green border-l-2 border-vault-green' 
                    : 'text-vault-green/80 hover:bg-vault-green/10 hover:text-vault-green border-l-2 border-transparent hover:border-vault-green/50'
                  }
                  ${hoveredIndex === index && 'bg-vault-green/10 text-vault-green'}
                `}
              >
                <span className="flex items-center space-x-2">
                  {option.value === value && (
                    <span className="text-vault-green animate-pulse">▶</span>
                  )}
                  <span>{option.label}</span>
                </span>
                {option.value === value && (
                  <span className="text-xs text-vault-green/50">[SELECTED]</span>
                )}
              </button>
            ))}
          </div>

          {/* Terminal footer */}
          <div className="px-3 py-1 border-t border-vault-green/30 bg-vault-green/5">
            <span className="text-xs text-vault-green/50 font-terminal animate-pulse">
              ▶ AWAITING INPUT...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Export a simple version for native selects that just need styling
export const vaultSelectClassName = `
  w-full px-4 py-2.5 
  bg-black/50 
  border-2 border-vault-green/50 
  text-vault-green 
  font-terminal text-sm
  transition-all duration-200
  hover:border-vault-green hover:bg-vault-green/10 hover:shadow-lg hover:shadow-vault-green/20
  focus:outline-none focus:border-vault-green focus:shadow-lg focus:shadow-vault-green/30
  appearance-none
  cursor-pointer
  disabled:opacity-50 disabled:cursor-not-allowed
`;

// Style for native select with custom arrow
export const VaultSelectNative: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ 
  className = '', 
  children, 
  ...props 
}) => {
  return (
    <div className="relative">
      <select 
        className={`${vaultSelectClassName} pr-10 ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown 
        size={16} 
        className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-green/70 pointer-events-none" 
      />
    </div>
  );
};