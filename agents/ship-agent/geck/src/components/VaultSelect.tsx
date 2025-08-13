import React, { forwardRef } from 'react';
import { Select, SelectProps } from './ui/Select';

// Convert old VaultSelect props to new Select props
interface LegacyVaultSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }> | string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Legacy component - converts props and redirects to themed Select component
export const VaultSelect: React.FC<LegacyVaultSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled
}) => {
  // Convert string array to SelectOption format if needed
  const selectOptions = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  return (
    <Select
      value={value}
      onChange={onChange}
      options={selectOptions}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
};

VaultSelect.displayName = 'VaultSelect';

// Native select version (for compatibility)
export const VaultSelectNative: React.FC<LegacyVaultSelectProps> = (props) => {
  return <VaultSelect {...props} />;
};