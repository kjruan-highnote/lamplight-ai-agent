import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../themes/ThemeContext';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ 
    className = '', 
    variant = 'default', 
    padding = 'md',
    interactive = false,
    style,
    children,
    ...props 
  }, ref) => {
    const { theme } = useTheme();
    
    const baseStyles: React.CSSProperties = {
      borderRadius: theme.borders.radius.lg,
      transition: theme.effects.transition.base,
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      default: {
        backgroundColor: theme.colors.surface,
        borderWidth: theme.borders.width.thin,
        borderStyle: 'solid',
        borderColor: theme.colors.border,
      },
      bordered: {
        backgroundColor: 'transparent',
        borderWidth: theme.borders.width.base,
        borderStyle: 'solid',
        borderColor: theme.colors.border,
      },
      elevated: {
        backgroundColor: theme.colors.surface,
        borderWidth: 0,
        boxShadow: theme.effects.shadow.md,
      },
      ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
    };

    const paddingStyles: Record<string, React.CSSProperties> = {
      none: { padding: 0 },
      sm: { padding: theme.spacing.sm },
      md: { padding: theme.spacing.md },
      lg: { padding: theme.spacing.lg },
    };

    const interactiveStyles: React.CSSProperties = interactive ? {
      cursor: 'pointer',
    } : {};

    const hoverStyles: React.CSSProperties = interactive ? {
      backgroundColor: theme.colors.surfaceHover,
      borderColor: theme.colors.borderHover,
      boxShadow: theme.effects.shadow.lg,
      transform: 'translateY(-2px)',
    } : {};

    return (
      <div
        ref={ref}
        className={cn(
          'ui-card',
          `ui-card--${variant}`,
          interactive && 'ui-card--interactive',
          className
        )}
        style={{
          ...baseStyles,
          ...variantStyles[variant],
          ...paddingStyles[padding],
          ...interactiveStyles,
          ...style,
        }}
        onMouseEnter={(e) => {
          if (interactive) {
            Object.assign((e.currentTarget as HTMLElement).style, hoverStyles);
          }
        }}
        onMouseLeave={(e) => {
          if (interactive) {
            Object.assign((e.currentTarget as HTMLElement).style, variantStyles[variant]);
            (e.currentTarget as HTMLElement).style.transform = 'none';
          }
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', style, children, ...props }, ref) => {
    const { theme } = useTheme();
    
    const headerStyles: React.CSSProperties = {
      padding: theme.spacing.md,
      borderBottom: `${theme.borders.width.thin} solid ${theme.colors.border}`,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={cn('ui-card-header', className)}
        style={headerStyles}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', style, children, ...props }, ref) => {
    const { theme } = useTheme();
    
    const contentStyles: React.CSSProperties = {
      padding: theme.spacing.md,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={cn('ui-card-content', className)}
        style={contentStyles}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', style, children, ...props }, ref) => {
    const { theme } = useTheme();
    
    const footerStyles: React.CSSProperties = {
      padding: theme.spacing.md,
      borderTop: `${theme.borders.width.thin} solid ${theme.colors.border}`,
      ...style,
    };

    return (
      <div
        ref={ref}
        className={cn('ui-card-footer', className)}
        style={footerStyles}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';