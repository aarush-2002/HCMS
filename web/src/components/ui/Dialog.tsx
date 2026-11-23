import React, { useEffect, useRef } from 'react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  actions,
  maxWidth = 'md',
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
        className={`w-full ${widthStyles[maxWidth]} bg-[rgba(10,14,18,0.96)] border border-[rgba(223,231,224,0.16)] rounded-sm shadow-2xl p-6 text-[#dfe7e0] flex flex-col gap-4 animate-in zoom-in-95 duration-150`}
      >
        <div className="flex items-start justify-between gap-4 pb-2 border-b border-[rgba(223,231,224,0.1)]">
          <div>
            <h2 id="dialog-title" className="text-lg font-medium text-[#dfe7e0] tracking-tight">
              {title}
            </h2>
            {description && (
              <p id="dialog-description" className="text-xs text-[#9aa5a0] mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#9aa5a0] hover:text-[#dfe7e0] hover:bg-[rgba(223,231,224,0.06)] rounded-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-[#f5a524]"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="py-2">{children}</div>

        {actions && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[rgba(223,231,224,0.1)]">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dialog;
