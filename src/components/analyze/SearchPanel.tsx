'use client';

import type { SearchState } from '@/types/analyze';
import { cn } from '@/lib/utils';

interface SearchPanelProps {
  status: 'pending' | 'active' | 'completed' | 'error';
  results: SearchState | null;
  error?: string | null;
  onRetry?: () => void;
  showRawJson?: boolean;
  onSelectSupplement?: (id: string) => void;
}

export function SearchPanel({
  status,
  results,
  error,
  onRetry,
  showRawJson,
  onSelectSupplement,
}: SearchPanelProps) {
  const isLoading = status === 'active';

  return (
    <section className="rounded-3xl border border-border-light bg-white p-6 shadow-sm" aria-labelledby="search-panel-heading">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="search-panel-heading" className="text-lg font-semibold text-text-dark">
            Database Match Results
          </h3>
          <p className="text-sm text-text-secondary">
            Use label insights to perform fuzzy matching with the database for quick comparisons.
          </p>
        </div>
        {results ? (
          <span className="text-xs font-medium text-text-muted">
            Total {results.pagination.total} candidates · Query duration {(results.durationMs / 1000).toFixed(2)}s
          </span>
        ) : null}
      </header>

      <div className={cn('mt-6 rounded-2xl border p-4', status === 'error' && 'border-red-300 bg-red-50')} aria-live="polite">
        {status === 'pending' ? (
          <p className="text-sm text-text-secondary">Awaiting AI analysis results before automatically searching related supplements.</p>
        ) : null}

        {isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-dashed border-border-muted p-4">
                <div className="h-4 w-48 motion-safe:animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-3 w-full motion-safe:animate-pulse rounded bg-gray-100" />
                <div className="mt-2 h-3 w-3/4 motion-safe:animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : null}

        {status === 'completed' && results ? (
          <div className="space-y-4">
            {results.supplements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-muted p-4 text-sm text-text-secondary">
                No matches yet. Try adjusting keywords or providing more brand details.
              </div>
            ) : (
              results.supplements.map((supplement) => (
                <button
                  type="button"
                  key={supplement.id}
                  className="w-full rounded-2xl border border-border-light bg-gray-50 p-4 text-left transition hover:border-brand-medical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
                  onClick={() => onSelectSupplement?.(supplement.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-base font-semibold text-text-dark">{supplement.name}</h4>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-text-muted">
                      {supplement.category}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">Brand: {supplement.brand}</p>
                  {supplement.ingredients?.length ? (
                    <p className="mt-2 text-xs text-text-muted">
                      Ingredient highlights: {supplement.ingredients.slice(0, 3).map((ingredient) => ingredient.name).join(' · ')}
                      {supplement.ingredients.length > 3 ? '…' : ''}
                    </p>
                  ) : null}
                </button>
              ))
            )}

            {showRawJson ? (
              <pre className="overflow-auto rounded-lg bg-black/5 p-3 text-xs text-slate-700">
                {JSON.stringify(results, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}

        {status === 'error' && error ? (
          <div>
            <p className="text-sm font-medium text-red-600">Search failed: {error}</p>
            <p className="mt-1 text-xs text-red-500">You can retry later or refine the keywords manually.</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {status === 'error' && onRetry ? (
          <button
            type="button"
            className="rounded-full bg-brand-medical px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-medical/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
            onClick={onRetry}
          >
            Retry search
          </button>
        ) : null}
      </div>
    </section>
  );
}
