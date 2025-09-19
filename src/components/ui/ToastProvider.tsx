'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn, generateId } from '@/lib/utils';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  id?: string;
  tone?: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export interface Toast extends ToastOptions {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastTone, ReactElement> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />,
  error: <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />,
  info: <Info className="h-5 w-5 text-blue-500" aria-hidden="true" />,
};

export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    const timerId = timersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }
  }, []);

  const scheduleRemoval = useCallback((toast: Toast) => {
    const duration = toast.durationMs ?? 5000;
    if (duration <= 0) return;
    const timerId = window.setTimeout(() => dismissToast(toast.id), duration);
    timersRef.current.set(toast.id, timerId);
  }, [dismissToast]);

  const showToast = useCallback((options: ToastOptions) => {
    const toast: Toast = {
      id: options.id ?? generateId(),
      tone: options.tone ?? 'info',
      title: options.title,
      description: options.description,
      durationMs: options.durationMs,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      createdAt: Date.now(),
    };

    setToasts(prev => [toast, ...prev]);
    scheduleRemoval(toast);
    return toast.id;
  }, [scheduleRemoval]);

  const clearAll = useCallback(() => {
    timersRef.current.forEach(timerId => window.clearTimeout(timerId));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  // Cleanup timers when provider unmounts
  useEffect(() => clearAll, [clearAll]);

  const value = useMemo<ToastContextValue>(() => ({ toasts, showToast, dismissToast, clearAll }), [toasts, showToast, dismissToast, clearAll]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed inset-x-0 top-4 z-[1000] flex flex-col items-center space-y-2 px-4 sm:items-end sm:pr-6"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              'w-full sm:w-96 rounded-xl border shadow-lg bg-white/95 backdrop-blur-sm',
              'border-border-light focus-within:ring-2 focus-within:ring-brand-medical',
            )}
            role="status"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5" aria-hidden="true">
                {ICONS[toast.tone ?? 'info']}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-dark">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-sm text-text-secondary">{toast.description}</p>
                ) : null}
                {toast.actionLabel && toast.onAction ? (
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-brand-medical hover:underline"
                    onClick={() => {
                      toast.onAction?.();
                      dismissToast(toast.id);
                    }}
                  >
                    {toast.actionLabel}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close notification"
                className="ml-2 rounded-full p-1 text-text-muted hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
                onClick={() => dismissToast(toast.id)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
