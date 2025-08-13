import React, { forwardRef } from 'react';
import { Search } from 'lucide-react';

interface VaultInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const VaultInput = forwardRef<HTMLInputElement, VaultInputProps>(
  ({ className = '', icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-vault-green/50">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full ${icon ? 'pl-10' : 'px-4'} pr-4 py-2.5
            bg-black/50
            border-2 border-vault-green/50
            text-vault-green
            font-terminal text-sm
            placeholder-vault-green/30
            transition-all duration-200
            hover:border-vault-green hover:bg-vault-green/10 hover:shadow-lg hover:shadow-vault-green/20
            focus:outline-none focus:border-vault-green focus:bg-vault-green/10 focus:shadow-lg focus:shadow-vault-green/30
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
      </div>
    );
  }
);

VaultInput.displayName = 'VaultInput';

interface VaultTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const VaultTextarea = forwardRef<HTMLTextAreaElement, VaultTextareaProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`
          w-full px-4 py-2.5
          bg-black/50
          border-2 border-vault-green/50
          text-vault-green
          font-terminal text-sm
          placeholder-vault-green/30
          transition-all duration-200
          hover:border-vault-green hover:bg-vault-green/10 hover:shadow-lg hover:shadow-vault-green/20
          focus:outline-none focus:border-vault-green focus:bg-vault-green/10 focus:shadow-lg focus:shadow-vault-green/30
          disabled:opacity-50 disabled:cursor-not-allowed
          resize-y
          ${className}
        `}
        {...props}
      />
    );
  }
);

VaultTextarea.displayName = 'VaultTextarea';

interface VaultSearchProps extends Omit<VaultInputProps, 'icon'> {}

export const VaultSearch: React.FC<VaultSearchProps> = (props) => {
  return (
    <VaultInput
      icon={<Search size={20} />}
      placeholder="Search..."
      {...props}
    />
  );
};

// Export class names for use with native elements
export const vaultInputClassName = `
  w-full px-4 py-2.5
  bg-black/50
  border-2 border-vault-green/50
  text-vault-green
  font-terminal text-sm
  placeholder-vault-green/30
  transition-all duration-200
  hover:border-vault-green hover:bg-vault-green/10 hover:shadow-lg hover:shadow-vault-green/20
  focus:outline-none focus:border-vault-green focus:bg-vault-green/10 focus:shadow-lg focus:shadow-vault-green/30
  disabled:opacity-50 disabled:cursor-not-allowed
`;