'use client';

import type { HistoryEntry } from '@/types/analyze';
import { cn, formatDate, formatTime } from '@/lib/utils';

interface HistoryDrawerProps {
  history: HistoryEntry[];
  activeId: string | null;
  onSelect: (entry: HistoryEntry) => void;
  onClear?: () => void;
}

export function HistoryDrawer({ history, activeId, onSelect, onClear }: HistoryDrawerProps) {
  return (
    <aside
      aria-label="Session history"
      className="flex h-full flex-col gap-4 rounded-3xl border border-border-light bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-dark">History</h3>
          <p className="text-xs text-text-secondary">Stores up to the last 8 scans; click any entry to revisit.</p>
        </div>
        <button
          type="button"
          className="text-xs text-text-muted hover:text-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onClear}
          disabled={!history.length || !onClear}
        >
          Clear
        </button>
      </div>

      <ul className="flex-1 space-y-3 overflow-y-auto" role="list">
        {history.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border-muted p-4 text-sm text-text-secondary">
            No history yet; completed analyses will appear here automatically.
          </li>
        ) : (
          history.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left transition',
                  activeId === entry.id
                    ? 'border-brand-medical bg-brand-medical/10 text-brand-medical'
                    : 'border-border-light bg-gray-50 text-text-dark hover:border-brand-medical'
                )}
                onClick={() => onSelect(entry)}
              >
                <p className="text-sm font-medium">
                  {entry.analysis?.supplementName ?? entry.ocr?.productName ?? 'Untitled scan'}
                </p>
                <p className="text-xs text-text-secondary">
                  {formatDate(new Date(entry.timestamp))} {formatTime(new Date(entry.timestamp))}
                </p>
                {entry.analysis?.brand ? (
                  <p className="mt-1 text-xs text-text-muted">Brand: {entry.analysis.brand}</p>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
