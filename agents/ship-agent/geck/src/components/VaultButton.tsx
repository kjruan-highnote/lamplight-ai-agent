import React, { forwardRef } from 'react';
import { Button, ButtonProps } from './ui/Button';
import { cn } from '../lib/utils';

// Legacy component - redirects to themed Button component
export const VaultButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    return <Button ref={ref} {...props} />;
  }
);

VaultButton.displayName = 'VaultButton';

// Terminal-style button (for backward compatibility)
export const TerminalButton: React.FC<ButtonProps & { command?: string }> = ({ 
  children, 
  command,
  ...props 
}) => {
  return (
    <Button {...props}>
      {command && <span className="opacity-50 mr-1">{'>'}</span>}
      {children}
    </Button>
  );
};

// Icon button variant (for backward compatibility)
export const VaultIconButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', size = 'md', ...props }, ref) => {
    const iconSizeClasses = {
      sm: 'p-1.5',
      md: 'p-2',
      lg: 'p-3'
    };

    return (
      <Button
        ref={ref}
        className={cn(iconSizeClasses[size], 'aspect-square', className)}
        size={size}
        {...props}
      />
    );
  }
);

VaultIconButton.displayName = 'VaultIconButton';