import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../themes/ThemeContext';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', icon, error = false, style, ...props }, ref) => {
    const { theme } = useTheme();
    
    const inputStyles: React.CSSProperties = {
      width: '100%',
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      paddingLeft: icon ? `calc(${theme.spacing.md} * 2.5)` : theme.spacing.md,
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)',
      borderWidth: theme.borders.width.base,
      borderStyle: 'solid',
      borderColor: error ? theme.colors.danger : theme.colors.border,
      borderRadius: theme.borders.radius.md,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily.base,
      fontSize: theme.typography.fontSize.base,
      transition: theme.effects.transition.base,
      outline: 'none',
      ...style,
    };

    const focusStyles: React.CSSProperties = {
      borderColor: error ? theme.colors.danger : theme.colors.primary,
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,1)',
      boxShadow: error ? theme.effects.shadow.sm.replace('rgba(65, 247, 107', `rgba(239, 68, 68`) : theme.effects.shadow.sm,
    };

    const placeholderColor = theme.colors.placeholder;

    return (
      <div className="relative">
        {icon && (
          <div 
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: theme.colors.textMuted }}
          >
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn('ui-input', error && 'ui-input--error', className)}
          style={inputStyles}
          onFocus={(e) => {
            Object.assign(e.target.style, focusStyles);
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? theme.colors.danger : theme.colors.border;
            e.target.style.backgroundColor = theme.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)';
            e.target.style.boxShadow = 'none';
          }}
          {...props}
        />
        <style>{`
          .ui-input::placeholder {
            color: ${placeholderColor};
          }
        `}</style>
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', error = false, style, ...props }, ref) => {
    const { theme } = useTheme();
    
    const textareaStyles: React.CSSProperties = {
      width: '100%',
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)',
      borderWidth: theme.borders.width.base,
      borderStyle: 'solid',
      borderColor: error ? theme.colors.danger : theme.colors.border,
      borderRadius: theme.borders.radius.md,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily.base,
      fontSize: theme.typography.fontSize.base,
      transition: theme.effects.transition.base,
      outline: 'none',
      resize: 'vertical',
      minHeight: '100px',
      ...style,
    };

    const focusStyles: React.CSSProperties = {
      borderColor: error ? theme.colors.danger : theme.colors.primary,
      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,1)',
      boxShadow: error ? theme.effects.shadow.sm.replace('rgba(65, 247, 107', `rgba(239, 68, 68`) : theme.effects.shadow.sm,
    };

    return (
      <textarea
        ref={ref}
        className={cn('ui-textarea', error && 'ui-textarea--error', className)}
        style={textareaStyles}
        onFocus={(e) => {
          Object.assign(e.target.style, focusStyles);
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? theme.colors.danger : theme.colors.border;
          e.target.style.backgroundColor = theme.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)';
          e.target.style.boxShadow = 'none';
        }}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';