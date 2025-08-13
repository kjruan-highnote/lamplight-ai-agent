import React, { forwardRef } from 'react';
import { Input, InputProps, Textarea, TextareaProps } from './ui/Input';

// Legacy component - redirects to themed Input component
export const VaultInput = forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => {
    return <Input ref={ref} {...props} />;
  }
);

VaultInput.displayName = 'VaultInput';

// Legacy component - redirects to themed Input with search icon
export const VaultSearch = forwardRef<HTMLInputElement, InputProps>(
  (props, ref) => {
    return <Input ref={ref} {...props} />;
  }
);

VaultSearch.displayName = 'VaultSearch';

// Legacy component - redirects to themed Textarea component
export const VaultTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (props, ref) => {
    return <Textarea ref={ref} {...props} />;
  }
);

VaultTextarea.displayName = 'VaultTextarea';