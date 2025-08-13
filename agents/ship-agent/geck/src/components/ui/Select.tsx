import React, { forwardRef, useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../themes/ThemeContext';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  className?: string;
}

export const Select = forwardRef<HTMLDivElement, SelectProps>(
  ({ options, value, onChange, placeholder = 'Select...', error = false, disabled = false, className = '' }, ref) => {
    const { theme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState(value || '');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (value !== undefined) {
        setSelectedValue(value);
      }
    }, [value]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
      setSelectedValue(optionValue);
      if (onChange) {
        onChange(optionValue);
      }
      setIsOpen(false);
    };

    const selectedOption = options.find(opt => opt.value === selectedValue);

    const triggerStyles: React.CSSProperties = {
      width: '100%',
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      paddingRight: `calc(${theme.spacing.md} * 2.5)`,
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)',
      borderWidth: theme.borders.width.base,
      borderStyle: 'solid',
      borderColor: error ? theme.colors.danger : theme.colors.border,
      borderRadius: theme.borders.radius.md,
      color: selectedOption ? theme.colors.text : theme.colors.placeholder,
      fontFamily: theme.typography.fontFamily.base,
      fontSize: theme.typography.fontSize.base,
      transition: theme.effects.transition.base,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    };

    const dropdownStyles: React.CSSProperties = {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: theme.spacing.xs,
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.98)',
      borderWidth: theme.borders.width.base,
      borderStyle: 'solid',
      borderColor: theme.colors.border,
      borderRadius: theme.borders.radius.md,
      boxShadow: theme.effects.shadow.lg,
      maxHeight: '200px',
      overflowY: 'auto',
      zIndex: 50,
    };

    const optionStyles = (selected: boolean, optionDisabled: boolean): React.CSSProperties => ({
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      paddingRight: `calc(${theme.spacing.md} * 2.5)`,
      backgroundColor: selected ? theme.colors.primaryBackground : 'transparent',
      color: optionDisabled ? theme.colors.textMuted : theme.colors.text,
      fontFamily: theme.typography.fontFamily.base,
      fontSize: theme.typography.fontSize.base,
      cursor: optionDisabled ? 'not-allowed' : 'pointer',
      opacity: optionDisabled ? 0.5 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      transition: theme.effects.transition.fast,
    });

    const optionHoverStyles: React.CSSProperties = {
      backgroundColor: theme.colors.surfaceHover,
    };

    return (
      <div ref={dropdownRef} className={cn('ui-select', 'relative', className)}>
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          style={triggerStyles}
          onMouseEnter={(e) => {
            if (!disabled) {
              (e.currentTarget as HTMLElement).style.borderColor = error ? theme.colors.danger : theme.colors.borderHover;
              (e.currentTarget as HTMLElement).style.boxShadow = theme.effects.shadow.sm;
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = error ? theme.colors.danger : theme.colors.border;
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronDown 
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
            size={16}
            style={{ color: theme.colors.textMuted }}
          />
        </div>

        {isOpen && (
          <div style={dropdownStyles}>
            {options.map(option => (
              <div
                key={option.value}
                onClick={() => {
                  console.log('[Select] Option clicked:', option.value, 'disabled:', option.disabled);
                  if (!option.disabled) {
                    handleSelect(option.value);
                  }
                }}
                style={optionStyles(option.value === selectedValue, !!option.disabled)}
                onMouseEnter={(e) => {
                  if (!option.disabled) {
                    Object.assign((e.target as HTMLElement).style, optionHoverStyles);
                  }
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 
                    option.value === selectedValue ? theme.colors.primaryBackground : 'transparent';
                }}
              >
                <span>{option.label}</span>
                {option.value === selectedValue && (
                  <Check size={16} style={{ color: theme.colors.primary }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';