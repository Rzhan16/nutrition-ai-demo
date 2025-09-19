'use client';

import { useContext, useMemo } from 'react';
import type { AnalysisState } from '@/types/analyze';
import { cn } from '@/lib/utils';
import { SmartScanContext, type DsldNormalized } from '@/components/analyze/SmartScanContext';

const DSLD_ENABLED = process.env.NEXT_PUBLIC_DSLD_ENABLED === 'true';
type DsldIngredientRow = NonNullable<DsldNormalized['ingredientRows']>[number];

type AnalysisRecord = Record<string, string | undefined>;

type AnalyzePanelAnalysis = (AnalysisState & {
  analysis?: AnalysisRecord;
}) | null;

interface AnalyzePanelProps {
  status: 'pending' | 'active' | 'completed' | 'error';
  analysis?: AnalyzePanelAnalysis;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
  showRawJson?: boolean;
  showTimings?: boolean;
  dsld?: DsldNormalized | null;
}

const ANALYSIS_SECTIONS: Array<{
  key: keyof AnalysisState['analysis'];
  title: string;
}> = [
  { key: 'basicIntroduction', title: 'Basic Introduction' },
  { key: 'primaryBenefits', title: 'Primary Benefits' },
  { key: 'rdaGuidelines', title: 'Recommended Intake (RDA)' },
  { key: 'safetyLimits', title: 'Upper Limit (UL)' },
  { key: 'dietarySources', title: 'Common Dietary Sources' },
  { key: 'supplementForms', title: 'Common Supplement Forms' },
  { key: 'usageScenarios', title: 'Applicable Scenarios' },
  { key: 'risksPrecautions', title: 'Risks & Precautions' },
];

export function AnalyzePanel({
  status,
  analysis,
  error,
  onRetry,
  onCancel,
  showRawJson,
  showTimings,
  dsld,
}: AnalyzePanelProps) {
  const isLoading = status === 'active';
  const smartScanContext = useContext(SmartScanContext);
  const dsldState = smartScanContext?.state.dsld;
  const analysisData: AnalysisRecord = (analysis?.analysis as AnalysisRecord | undefined) ?? {};
  const filledSections = ANALYSIS_SECTIONS.filter((section) => {
    const value = (analysisData[section.key] ?? '').trim();
    return value.length > 0;
  });
  const noAnalysisMessage = 'No analysis available yet. Run analysis to see results here.';

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

  return (
    <section className="rounded-3xl border border-border-light bg-white p-6 shadow-sm" aria-labelledby="analysis-panel-heading">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="analysis-panel-heading" className="text-lg font-semibold text-text-dark">
            AI Nutrition Analysis
          </h3>
          <p className="text-sm text-text-secondary">
            Combine barcode, OCR, and database information to deliver an eight-point professional analysis.
          </p>
        </div>
        {showTimings && analysis ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Analysis duration {(analysis.durationMs / 1000).toFixed(2)}s
          </span>
        ) : null}
      </header>

      <div className={cn('mt-6 rounded-2xl border p-4', status === 'error' && 'border-red-300 bg-red-50')} aria-live="polite">
        {status === 'pending' ? (
          <p className="text-sm text-text-secondary">Waiting for OCR results before running AI analysis.</p>
        ) : null}

        {isLoading ? (
          <div className="space-y-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 w-32 motion-safe:animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-full motion-safe:animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-3/4 motion-safe:animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : null}

        {status === 'completed' ? (
          analysis ? (
            <div className="space-y-6 text-sm leading-relaxed text-text-secondary">
              <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gray-50 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Supplement</p>
                  <p className="text-base font-semibold text-text-dark">{analysis.supplementName}</p>
                </div>
                {analysis.brand ? (
                  <div>
                    <p className="text-xs font-semibold uppercase text-text-muted">Brand</p>
                    <p className="text-base font-semibold text-text-dark">{analysis.brand}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">AI Confidence</p>
                  <p className="text-base font-semibold text-text-dark">{(analysis.confidence * 100).toFixed(1)}%</p>
                </div>
                {DSLD_ENABLED && isDsldLoading ? (
                  <span className="text-xs text-text-muted">Matching NIH DSLD records…</span>
                ) : null}
                {DSLD_ENABLED && dsldSummaryLine ? (
                  <div>
                    <p className="text-xs font-semibold uppercase text-emerald-700">NIH DSLD Match</p>
                    <p className="text-sm text-text-secondary">{dsldSummaryLine}</p>
                  </div>
                ) : null}
                {analysis.cached ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">From cache</span>
                ) : null}
              </div>

              {filledSections.length === 0 ? (
                <div className="text-sm text-text-muted">{noAnalysisMessage}</div>
              ) : (
                filledSections.map((section) => {
                  const value = (analysisData[section.key] ?? '').trim();
                  return (
                    <div key={section.key}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{section.title}</p>
                      <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{value}</p>
                    </div>
                  );
                })
              )}

              {analysis.ingredients?.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Key Ingredients</p>
                  <ul className="mt-2 grid gap-2 text-sm text-text-secondary md:grid-cols-2">
                    {analysis.ingredients.map((ingredient) => (
                      <li key={`${ingredient.name}-${ingredient.amount}`} className="rounded-xl bg-gray-50 p-3">
                        <p className="font-medium text-text-dark">{ingredient.name}</p>
                        <p className="text-xs text-text-muted">
                          {ingredient.amount}
                          {ingredient.unit ? ` ${ingredient.unit}` : ''}
                          {ingredient.dailyValue ? ` · ${ingredient.dailyValue}% DV` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {DSLD_ENABLED && dsldTopIngredients.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">DSLD highlighted ingredients</p>
                  <ul className="mt-2 grid gap-2 text-sm text-text-secondary md:grid-cols-2">
                    {dsldTopIngredients.map((item, index) => {
                      const details = [
                        item?.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : null,
                        item?.dvPercent != null ? `${item.dvPercent}% DV` : null,
                        item?.notes && item.notes.trim() ? item.notes.trim() : null,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <li key={`${item?.name ?? 'ingredient'}-${index}`} className="rounded-xl bg-gray-50 p-3">
                          <p className="font-medium text-text-dark">{item?.name ?? 'Ingredient'}</p>
                          {details ? <p className="text-xs text-text-muted">{details}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {analysis.recommendations?.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Usage Recommendations</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {analysis.recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {showRawJson ? (
                <pre className="overflow-auto rounded-lg bg-black/5 p-3 text-xs text-slate-700">
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-text-muted">{noAnalysisMessage}</div>
          )
        ) : null}

        {status === 'error' && error ? (
          <div>
            <p className="text-sm font-medium text-red-600">Analysis failed: {error}</p>
            <p className="mt-1 text-xs text-red-500">Try submitting again or enable Mock Analyze for debugging.</p>
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
            Cancel analysis
          </button>
        ) : null}
        {status === 'error' && onRetry ? (
          <button
            type="button"
            className="rounded-full bg-brand-medical px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-medical/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
            onClick={onRetry}
          >
            Retry analysis
          </button>
        ) : null}
      </div>
    </section>
  );
}
