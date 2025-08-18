import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../themes/ThemeContext';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md'
}) => {
  const { theme } = useTheme();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getMaxWidth = () => {
    switch (size) {
      case 'sm':
        return '400px';
      case 'lg':
        return '800px';
      case 'xl':
        return '1200px';
      case '2xl':
        return '1920px';  // Increased from 1600px (~20% larger)
      case '3xl':
        return '95vw';  // Almost full width for maximum space
      default:
        return '600px';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)'
        }}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full mx-4 animate-fadeIn"
        style={{ maxWidth: getMaxWidth() }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-lg shadow-2xl"
          style={{
            backgroundColor: theme.colors.background,
            border: `2px solid ${theme.colors.primaryBorder}`,
            boxShadow: theme.id === 'vault-tec' ? `0 0 20px ${theme.colors.primary}40` : undefined
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-6 border-b"
            style={{
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface
            }}
          >
            <h2
              className="font-semibold"
              style={{ 
                color: theme.colors.text,
                fontSize: theme.typography.fontSize.lg,
                textShadow: theme.id === 'vault-tec' ? theme.effects.customEffects?.textGlow : 'none'
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-opacity-10"
              style={{
                color: theme.colors.textMuted,
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primaryBackground;
                e.currentTarget.style.color = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textMuted;
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div
            className="p-6"
            style={{
              color: theme.colors.text,
              fontSize: theme.typography.fontSize.base,
              maxHeight: '84vh',  // Increased from 70vh (~20% larger)
              overflowY: 'auto'
            }}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div
              className="flex items-center justify-end gap-3 p-6 border-t"
              style={{
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal Component
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info'
}) => {
  const { theme } = useTheme();

  const getTypeColor = () => {
    switch (type) {
      case 'danger':
        return theme.colors.danger;
      case 'warning':
        return theme.colors.warning;
      default:
        return theme.colors.info;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={type === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p style={{ color: theme.colors.textSecondary }}>
        {message}
      </p>
    </Modal>
  );
};

// Input Modal Component
interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitText?: string;
  cancelText?: string;
  validate?: (value: string) => string | null;
}

export const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  submitText = 'Submit',
  cancelText = 'Cancel',
  validate
}) => {
  const { theme } = useTheme();
  const [value, setValue] = React.useState(defaultValue);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError(null);
      // Focus input after modal opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = () => {
    if (validate) {
      const validationError = validate(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    
    if (!value.trim()) {
      setError('This field is required');
      return;
    }

    onSubmit(value);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
          >
            {submitText}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {message && (
          <p style={{ color: theme.colors.textSecondary }}>
            {message}
          </p>
        )}
        <div>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-4 py-2 rounded-lg border-2 transition-colors"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: error ? theme.colors.danger : theme.colors.border,
              color: theme.colors.text,
              outline: 'none'
            }}
            onFocus={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = theme.colors.primaryBorder;
              }
            }}
            onBlur={(e) => {
              if (!error) {
                e.currentTarget.style.borderColor = theme.colors.border;
              }
            }}
          />
          {error && (
            <p className="text-sm mt-1" style={{ color: theme.colors.danger }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};