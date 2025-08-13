import React, { forwardRef } from 'react';
import { cn } from '../lib/utils';

interface VaultButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const VaultButton = forwardRef<HTMLButtonElement, VaultButtonProps>(
  ({ 
    className = '', 
    variant = 'primary', 
    size = 'md', 
    loading = false,
    disabled = false,
    icon,
    children,
    ...props 
  }, ref) => {
    const baseClasses = `
      font-terminal
      border-2
      transition-all duration-200
      inline-flex items-center justify-center
      focus:outline-none
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const variantClasses = {
      primary: `
        bg-vault-green/20 
        border-vault-green/50 
        text-vault-green
        hover:bg-vault-green/30 
        hover:border-vault-green 
        hover:shadow-lg hover:shadow-vault-green/20
        focus:border-vault-green focus:shadow-lg focus:shadow-vault-green/30
        active:bg-vault-green/40
      `,
      secondary: `
        bg-gray-800/50 
        border-gray-700 
        text-gray-300
        hover:bg-gray-700/50 
        hover:border-gray-600 
        hover:text-vault-green
        hover:shadow-lg hover:shadow-gray-700/20
        focus:border-gray-600 focus:shadow-lg focus:shadow-gray-700/30
      `,
      danger: `
        bg-red-900/20 
        border-red-500/50 
        text-red-400
        hover:bg-red-900/30 
        hover:border-red-500 
        hover:shadow-lg hover:shadow-red-500/20
        focus:border-red-500 focus:shadow-lg focus:shadow-red-500/30
      `,
      ghost: `
        bg-transparent 
        border-transparent 
        text-vault-green/70
        hover:bg-vault-green/10 
        hover:border-vault-green/30 
        hover:text-vault-green
        focus:border-vault-green/30
      `
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs space-x-1.5',
      md: 'px-4 py-2 text-sm space-x-2',
      lg: 'px-6 py-3 text-base space-x-2.5'
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
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

VaultButton.displayName = 'VaultButton';

// Terminal-style button with typing animation effect
export const TerminalButton: React.FC<VaultButtonProps & { command?: string }> = ({ 
  children, 
  command,
  ...props 
}) => {
  return (
    <VaultButton {...props}>
      {command && <span className="text-vault-green/50 mr-1">{'>'}</span>}
      {children}
    </VaultButton>
  );
};

// Icon button variant
export const VaultIconButton = forwardRef<HTMLButtonElement, VaultButtonProps>(
  ({ className = '', size = 'md', ...props }, ref) => {
    const iconSizeClasses = {
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-3'
    };

    return (
      <VaultButton
        ref={ref}
        className={cn(iconSizeClasses[size], 'aspect-square', className)}
        size={size}
        {...props}
      />
    );
  }
);

VaultIconButton.displayName = 'VaultIconButton';