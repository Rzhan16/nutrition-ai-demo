'use client';

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { OcrState } from '@/types/analyze';
import { cn, formatBarcode } from '@/lib/utils';
import { SmartScanContext, type DsldNormalized } from '@/components/analyze/SmartScanContext';
import { searchDsld } from '@/lib/dsld/client';
import type { DsldSearchHit, DsldSearchMeta, DsldSearchMode } from '@/lib/dsld/types';

const DSLD_ENABLED = process.env.NEXT_PUBLIC_DSLD_ENABLED === 'true';

type DsldIngredientRow = NonNullable<DsldNormalized['ingredientRows']>[number];

type DsldResultsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  hits: DsldSearchHit[];
  mode: DsldSearchMode;
  total: number;
  fallback: boolean;
  preciseAttempted: boolean;
  meta?: DsldSearchMeta;
  error?: string;
};

const DEFAULT_DSLD_RESULTS_STATE: DsldResultsState = {
  status: 'idle',
  hits: [],
  mode: 'generic',
  total: 0,
  fallback: false,
  preciseAttempted: false,
};

interface ScanResultPanelProps {
  status: 'pending' | 'active' | 'completed' | 'error';
  progress: number;
  ocr: OcrState | null;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
  showRawJson?: boolean;
  dsld?: DsldNormalized | null;
}

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export function ScanResultPanel({
  status,
  progress,
  ocr,
  error,
  onRetry,
  onCancel,
  showRawJson,
  dsld,
}: ScanResultPanelProps) {
  const smartScanContext = useContext(SmartScanContext);
  const dsldState = smartScanContext?.state.dsld;
  const [dsldResultsState, setDsldResultsState] = useState<DsldResultsState>(DEFAULT_DSLD_RESULTS_STATE);
  const dsldQueryRef = useRef<string | null>(null);

  const recognitionData = useMemo(() => {
    if (!ocr || typeof ocr !== 'object') return undefined;
    const candidate = (ocr as { data?: { confidence?: number; text?: string } }).data;
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
    return undefined;
  }, [ocr]);

  const confidenceValue = useMemo(() => {
    const baseConfidence = ocr?.confidence ?? recognitionData?.confidence ?? 0;
    return baseConfidence > 1 ? baseConfidence / 100 : baseConfidence;
  }, [ocr, recognitionData]);

  const textValue = useMemo(() => ocr?.text ?? recognitionData?.text ?? '', [ocr, recognitionData]);

  const textPreview = useMemo(() => {
    if (!textValue) return '';
    return textValue.length > 280 ? `${textValue.slice(0, 280)}…` : textValue;
  }, [textValue]);

  const hasBarcode = Boolean(ocr?.barcode);
  const ingredients = ocr?.ingredients ?? [];

  const dsldData = useMemo(() => {
    if (!DSLD_ENABLED) {
      return dsld ?? null;
    }
    if (dsld) {
      return dsld;
    }
    if (!dsldState || dsldState.status !== 'success') {
      return null;
    }
    return dsldState.data;
  }, [dsld, dsldState]);

  const isDsldLoading = DSLD_ENABLED && dsldState?.status === 'loading';

  const dsldSummaryLine = useMemo(() => {
    if (!DSLD_ENABLED || !dsldData) {
      return null;
    }
    const parts = [dsldData.brandName, dsldData.fullName, dsldData.upcSku]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter((part) => part.length > 0);
    if (!parts.length) {
      return null;
    }
    return parts.join(' · ');
  }, [dsldData]);

  const dsldTopIngredients = useMemo<DsldIngredientRow[]>(() => {
    if (!DSLD_ENABLED || !Array.isArray(dsldData?.ingredientRows)) {
      return [];
    }
    return (dsldData.ingredientRows as DsldIngredientRow[])
      .filter((row) => row && (row.name || row.quantity != null || row.dvPercent != null))
      .slice(0, 3);
  }, [dsldData]);

  const dsldStatus = dsldResultsState.status;

  useEffect(() => {
    if (!DSLD_ENABLED) {
      if (dsldStatus !== 'idle') {
        setDsldResultsState({ ...DEFAULT_DSLD_RESULTS_STATE });
      }
      dsldQueryRef.current = null;
      return;
    }

    const query = dsldState?.query?.trim();
    if (!query || dsldState?.status === 'error') {
      dsldQueryRef.current = null;
      if (dsldStatus !== 'idle') {
        setDsldResultsState({ ...DEFAULT_DSLD_RESULTS_STATE });
      }
      return;
    }

    if (dsldQueryRef.current === query && (dsldStatus === 'loading' || dsldStatus === 'ready')) {
      return;
    }

    dsldQueryRef.current = query;
    let cancelled = false;
    const controller = new AbortController();

    setDsldResultsState((prev) => ({ ...prev, status: 'loading' }));

    void (async () => {
      try {
        const result = await searchDsld({ q: query, size: 20 }, { signal: controller.signal });
        if (cancelled) return;
        setDsldResultsState({
          status: 'ready',
          hits: Array.isArray(result.hits) ? result.hits : [],
          mode: result.mode,
          total: result.total,
          fallback: Boolean(result.meta?.preciseFallback),
          preciseAttempted: Boolean(result.meta?.attemptedPrecise),
          meta: result.meta,
        });
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unknown DSLD error';
        setDsldResultsState({
          ...DEFAULT_DSLD_RESULTS_STATE,
          status: 'error',
          error: message,
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dsldState?.query, dsldState?.status, dsldStatus]);

  const getHitFullName = useCallback((hit: DsldSearchHit): string | undefined => {
    const source = toRecord(hit?._source);
    return (
      toStringValue(source?.fullName) ??
      toStringValue(source?.fullNameTxt) ??
      toStringValue(source?.productName)
    );
  }, []);

  const getHitBrand = useCallback((hit: DsldSearchHit): string | undefined => {
    const source = toRecord(hit?._source);
    return toStringValue(source?.brandName) ?? toStringValue(source?.brand);
  }, []);

  const getHitPdf = useCallback((hit: DsldSearchHit): string | undefined => {
    const source = toRecord(hit?._source);
    return toStringValue(source?.pdf) ?? toStringValue(source?.thumbnail);
  }, []);

  const getHitLabelUrl = useCallback((hit: DsldSearchHit): string | undefined => {
    if (!hit?._id) return undefined;
    return `/api/dsld/label/${encodeURIComponent(hit._id)}`;
  }, []);

  const getIngredientHighlights = useCallback((hit: DsldSearchHit): string[] => {
    const source = toRecord(hit?._source);
    const raw = Array.isArray(source?.allIngredients) ? (source?.allIngredients as unknown[]) : [];
    const highlights: string[] = [];
    for (const entry of raw) {
      if (highlights.length >= 3) break;
      const record = toRecord(entry);
      const name = toStringValue(record?.name);
      if (name) {
        highlights.push(name);
      }
    }
    return highlights;
  }, []);

  const handleUseMatch = useCallback((hit: DsldSearchHit) => {
    const labelUrl = getHitLabelUrl(hit);
    if (typeof window === 'undefined') {
      console.debug('DSLD match selection (non-browser)', { hit });
      return;
    }
    if (labelUrl) {
      window.open(labelUrl, '_blank', 'noopener');
      return;
    }
    const pdfUrl = getHitPdf(hit);
    if (pdfUrl) {
      window.open(pdfUrl, '_blank', 'noopener');
      return;
    }
    console.debug('DSLD match selection without available link', { hit });
  }, [getHitLabelUrl, getHitPdf]);

  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>, hit: DsldSearchHit) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleUseMatch(hit);
      }
    },
    [handleUseMatch],
  );

  const renderResultCard = useCallback(
    (hit: DsldSearchHit, index: number) => {
      const fullName = getHitFullName(hit) ?? 'Unlabeled product';
      const brandName = getHitBrand(hit);
      const highlights = getIngredientHighlights(hit);
      const labelUrl = getHitLabelUrl(hit);
      const pdfUrl = getHitPdf(hit);
      const externalUrl = pdfUrl ?? labelUrl;

      return (
        <div
          key={hit._id ?? `${fullName}-${index}`}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => handleCardKeyDown(event, hit)}
          onClick={() => handleUseMatch(hit)}
          className="flex w-full cursor-pointer flex-col gap-3 rounded-2xl border border-border-light bg-card p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical md:flex-row md:items-start md:justify-between md:p-5"
        >
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {dsldResultsState.mode === 'precise' && index === 0 ? (
                <span className="rounded-full bg-brand-medical/10 px-2 py-0.5 text-xs font-semibold text-brand-medical">Exact</span>
              ) : null}
              <h4 className="truncate text-base font-semibold text-text-dark">{fullName}</h4>
            </div>
            {brandName ? (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                Brand: {brandName}
              </span>
            ) : null}
            {highlights.length ? (
              <p className="text-xs text-text-secondary">
                Ingredient highlights: {highlights.join(' · ')}
              </p>
            ) : null}
          </div>
          <div className="flex w-full items-end justify-end gap-2 md:w-auto md:flex-col md:items-end">
            <button
              type="button"
              className="rounded-full bg-brand-medical px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-medical/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
              onClick={(event) => {
                event.stopPropagation();
                handleUseMatch(hit);
              }}
            >
              Use this match
            </button>
            {externalUrl ? (
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-brand-medical hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Open DSLD
              </a>
            ) : null}
          </div>
        </div>
      );
    },
    [getHitBrand, getHitFullName, getHitLabelUrl, getHitPdf, getIngredientHighlights, handleCardKeyDown, handleUseMatch, dsldResultsState.mode],
  );

  const showDsldSection = DSLD_ENABLED && (dsldState?.query || dsldResultsState.status !== 'idle');

  return (
    <section className="rounded-3xl border border-border-light bg-white p-6 shadow-sm" aria-labelledby="scan-result-heading">
      <header className="flex items-center justify-between">
        <div>
          <h3 id="scan-result-heading" className="text-lg font-semibold text-text-dark">
            OCR Scan Results
          </h3>
          <p className="text-sm text-text-secondary">
            Automatically identify brand, product name, ingredients, and barcode, with manual review when needed.
          </p>
        </div>
        <span className="text-sm text-text-muted" aria-hidden="true">
          {progress}%
        </span>
      </header>

      <div className={cn('mt-6 rounded-2xl border p-4', status === 'error' && 'border-red-300 bg-red-50')} aria-live="polite">
        {status === 'pending' ? (
          <p className="text-sm text-text-secondary">Waiting for an uploaded file to begin recognition.</p>
        ) : null}

        {status === 'active' ? (
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <div className="h-3 w-3 motion-safe:animate-pulse rounded-full bg-brand-medical" aria-hidden="true" />
            Recognizing text…
          </div>
        ) : null}

        {status === 'completed' && ocr ? (
          <div className="space-y-3 text-sm text-text-secondary">
            <p>
              <span className="font-medium text-text-dark">Recognition confidence: </span>
              {(confidenceValue * 100).toFixed(1)}%
            </p>
            {ocr.brand ? (
              <p>
                <span className="font-medium text-text-dark">Brand: </span>
                {ocr.brand}
              </p>
            ) : null}
            {ocr.productName ? (
              <p>
                <span className="font-medium text-text-dark">Product name: </span>
                {ocr.productName}
              </p>
            ) : null}
            {ocr.servingSize ? (
              <p>
                <span className="font-medium text-text-dark">Serving size: </span>
                {ocr.servingSize}
              </p>
            ) : null}
            {hasBarcode && ocr?.barcode ? (
              <p>
                <span className="font-medium text-text-dark">Barcode: </span>
                {formatBarcode(ocr.barcode)}
              </p>
            ) : null}
            {DSLD_ENABLED && isDsldLoading ? (
              <p className="text-xs text-text-muted">Matching NIH DSLD records…</p>
            ) : null}
            {DSLD_ENABLED && dsldSummaryLine ? (
              <p className="text-xs text-emerald-700">
                <span className="font-semibold uppercase tracking-wide">Matched from NIH DSLD:</span>{' '}
                {dsldSummaryLine}
              </p>
            ) : null}
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Text preview</p>
              <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{textPreview}</p>
            </div>
            {ingredients.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Detected ingredients</p>
                <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                  {ingredients.slice(0, 6).map((ingredient) => (
                    <li key={`${ingredient.name}-${ingredient.amount ?? '0'}`}>
                      <span className="font-medium text-text-dark">{ingredient.name}</span>
                      {ingredient.amount ? ` · ${ingredient.amount}${ingredient.unit ?? ''}` : ''}
                    </li>
                  ))}
                  {ingredients.length > 6 ? (
                    <li className="text-xs text-text-muted">The remaining {ingredients.length - 6} entries appear in the analysis results.</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            {DSLD_ENABLED && dsldTopIngredients.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">DSLD highlighted ingredients</p>
                <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                  {dsldTopIngredients.map((item, index) => {
                    const details = [
                      item?.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : null,
                      item?.dvPercent != null ? `${item.dvPercent}% DV` : null,
                      item?.notes && item.notes.trim() ? item.notes.trim() : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <li key={`${item?.name ?? 'ingredient'}-${index}`}>
                        <span className="font-medium text-text-dark">{item?.name ?? 'Ingredient'}</span>
                        {details ? <span className="text-xs text-text-muted"> · {details}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {showDsldSection ? (
              <div className="space-y-3 border-t pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-dark">
                    {dsldResultsState.mode === 'precise' && dsldResultsState.total <= 1
                      ? 'Exact match from NIH DSLD'
                      : `Found ${dsldResultsState.total} NIH DSLD results`}
                  </p>
                  {dsldResultsState.mode === 'generic' ? (
                    <span className="text-xs text-text-muted">Showing up to 20. Refine your search for exact matches.</span>
                  ) : null}
                </div>

                {dsldResultsState.preciseAttempted && dsldResultsState.mode === 'generic' && dsldResultsState.fallback ? (
                  <p className="text-xs text-amber-700">No exact product found. Showing broader matches…</p>
                ) : null}

                {dsldStatus === 'loading' ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-dashed border-border-muted bg-card p-4"
                      >
                        <div className="h-4 w-40 motion-safe:animate-pulse rounded bg-gray-200" />
                        <div className="mt-2 h-3 w-32 motion-safe:animate-pulse rounded bg-gray-100" />
                        <div className="mt-2 h-3 w-full motion-safe:animate-pulse rounded bg-gray-100" />
                      </div>
                    ))}
                  </div>
                ) : null}

                {dsldStatus === 'error' ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-600">
                    {dsldResultsState.error ?? 'Unable to load DSLD matches.'}
                  </div>
                ) : null}

                {dsldStatus === 'ready' && dsldResultsState.hits.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-muted p-4 text-xs text-text-secondary">
                    No matches. Try narrowing your terms or include a brand name.
                  </div>
                ) : null}

                {dsldStatus === 'ready' && dsldResultsState.hits.length > 0 ? (
                  dsldResultsState.mode === 'precise' ? (
                    <div className="space-y-3">
                      {dsldResultsState.hits.slice(0, 1).map((hit, index) => renderResultCard(hit, index))}
                    </div>
                  ) : (
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                      {dsldResultsState.hits.slice(0, 20).map((hit, index) => renderResultCard(hit, index))}
                    </div>
                  )
                ) : null}
              </div>
            ) : null}

            {showRawJson ? (
              <pre className="mt-4 overflow-auto rounded-lg bg-black/5 p-3 text-xs text-slate-700">
                {JSON.stringify(ocr, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}

        {status === 'error' && error ? (
          <div>
            <p className="text-sm font-medium text-red-600">Recognition failed: {error}</p>
            <p className="mt-1 text-xs text-red-500">Check image clarity or try uploading again.</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {status === 'active' && onCancel ? (
          <button
            type="button"
            className="rounded-full border border-border-muted px-4 py-2 text-sm text-text-secondary hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
            onClick={onCancel}
          >
            Cancel OCR
          </button>
        ) : null}
        {status === 'error' && onRetry ? (
          <button
            type="button"
            className="rounded-full bg-brand-medical px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-medical/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
            onClick={onRetry}
          >
            Retry recognition
          </button>
        ) : null}
      </div>
    </section>
  );
}
