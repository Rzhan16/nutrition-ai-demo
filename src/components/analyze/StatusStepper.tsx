'use client';

import { cn } from '@/lib/utils';

export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface StepperItem {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
}

interface StatusStepperProps {
  steps: StepperItem[];
  className?: string;
}

export function StatusStepper({ steps, className }: StatusStepperProps) {
  return (
    <ol
      className={cn(
        'grid gap-3 rounded-2xl border border-border-light bg-surface-white p-4 shadow-sm md:grid-cols-5',
        className,
      )}
      aria-label="Scanning and analysis flow"
    >
      {steps.map((step, index) => {
        const isActive = step.status === 'active';
        const isCompleted = step.status === 'completed';
        const isError = step.status === 'error';

        return (
          <li
            key={step.id}
            className={cn(
              'flex items-start gap-4 rounded-xl px-3 py-2 transition-colors',
              isActive && 'bg-blue-50',
              isCompleted && 'bg-emerald-50',
              isError && 'bg-red-50',
            )}
            aria-current={isActive ? 'step' : undefined}
          >
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold',
                isCompleted && 'border-emerald-500 bg-emerald-500 text-white',
                isActive && 'border-brand-medical text-brand-medical',
                isError && 'border-red-500 text-red-600',
                !isActive && !isCompleted && !isError && 'border-border-muted text-text-secondary',
              )}
            >
              {isCompleted ? '✓' : index + 1}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-dark">{step.label}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{step.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
