import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration = 4500) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => {
          const typeConfig: Record<
            ToastType,
            { border: string; textCol: string; icon: string; bg: string }
          > = {
            info: {
              border: 'border-[#7fb4c9]/40',
              textCol: 'text-[#7fb4c9]',
              icon: 'ℹ',
              bg: 'bg-[rgba(10,14,18,0.95)]',
            },
            success: {
              border: 'border-[#6fcf97]/50',
              textCol: 'text-[#6fcf97]',
              icon: '✓',
              bg: 'bg-[rgba(10,14,18,0.95)]',
            },
            warning: {
              border: 'border-[#f5a524]/50',
              textCol: 'text-[#f5a524]',
              icon: '⚠',
              bg: 'bg-[rgba(10,14,18,0.95)]',
            },
            error: {
              border: 'border-[#ff5a5f]/60',
              textCol: 'text-[#ff5a5f]',
              icon: '✕',
              bg: 'bg-[rgba(10,14,18,0.95)]',
            },
          };

          const cfg = typeConfig[toast.type];

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto p-4 border rounded-sm shadow-xl flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150 ${cfg.bg} ${cfg.border} text-[#dfe7e0]`}
            >
              <span className={`text-base font-bold shrink-0 ${cfg.textCol}`} aria-hidden="true">
                {cfg.icon}
              </span>
              <p className="text-sm font-normal flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-[#9aa5a0] hover:text-[#dfe7e0] p-1 text-sm focus:outline-none"
                aria-label="Dismiss toast"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export default ToastProvider;
