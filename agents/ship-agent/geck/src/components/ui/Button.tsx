import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../themes/ThemeContext';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className = '', 
    variant = 'primary', 
    size = 'md', 
    loading = false,
    disabled = false,
    icon,
    children,
    style,
    ...props 
  }, ref) => {
    const { theme } = useTheme();
    
    const baseStyles: React.CSSProperties = {
      fontFamily: 'var(--font-base)',
      borderRadius: 'var(--radius-md)',
      borderWidth: theme.borders.width.base,
      borderStyle: 'solid',
      transition: theme.effects.transition.base,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        backgroundColor: theme.colors.primaryBackground,
        borderColor: theme.colors.primaryBorder,
        color: theme.colors.primary,
      },
      secondary: {
        backgroundColor: theme.colors.secondaryBackground,
        borderColor: theme.colors.border,
        color: theme.colors.text,
      },
      danger: {
        backgroundColor: `${theme.colors.danger}20`,
        borderColor: theme.colors.danger,
        color: theme.colors.danger,
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        color: theme.colors.textSecondary,
      },
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: {
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
        fontSize: theme.typography.fontSize.sm,
      },
      md: {
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        fontSize: theme.typography.fontSize.base,
      },
      lg: {
        padding: `${theme.spacing.md} ${theme.spacing.lg}`,
        fontSize: theme.typography.fontSize.lg,
      },
    };

    const hoverStyles: React.CSSProperties = {};
    if (!disabled) {
      if (variant === 'primary') {
        hoverStyles.backgroundColor = theme.colors.primaryBackground;
        hoverStyles.borderColor = theme.colors.primary;
        hoverStyles.boxShadow = theme.effects.shadow.md;
      } else if (variant === 'secondary') {
        hoverStyles.backgroundColor = theme.colors.surfaceHover;
        hoverStyles.borderColor = theme.colors.borderHover;
      }
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'ui-button',
          `ui-button--${variant}`,
          `ui-button--${size}`,
          className
        )}
        style={{
          ...baseStyles,
          ...variantStyles[variant],
          ...sizeStyles[size],
          ...style,
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            Object.assign((e.target as HTMLElement).style, hoverStyles);
          }
        }}
        onMouseLeave={(e) => {
          Object.assign((e.target as HTMLElement).style, variantStyles[variant]);
        }}
        {...props}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
                fill="none"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {children && <span>Loading...</span>}
          </>
        ) : (
          <>
            {icon}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';