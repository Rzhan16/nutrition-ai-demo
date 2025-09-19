'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Settings2, X } from 'lucide-react';
import { useSmartScan } from '@/components/analyze/SmartScanContext';
import type { BarcodeEngineOption } from '@/lib/types';

const ENGINE_OPTIONS: BarcodeEngineOption[] = ['auto', 'quagga', 'zxing', 'html5-qrcode'];

type DebugEvent = 'smartscan:debug-open' | 'smartscan:debug-close' | 'smartscan:debug-toggle';

const isBrowser = () => typeof window !== 'undefined';

const dispatchDebugEvent = (eventName: DebugEvent) => {
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(eventName));
  }
};

const formatConfidence = (value?: number): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—';

const formatDuration = (value?: number): string => (typeof value === 'number' ? `${value} ms` : '—');

const formatStatus = (value?: string): string => value ?? '—';

const formatError = (value?: string): string => value ?? '—';

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return [];
  const elements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
  );
  return Array.from(elements).filter((element) => !element.hasAttribute('data-focus-trap-skip'));
};

export function openDebugDrawer(): void {
  dispatchDebugEvent('smartscan:debug-open');
}

export function toggleDebugDrawer(): void {
  dispatchDebugEvent('smartscan:debug-toggle');
}

export function DebugDrawer(): ReactElement | null {
  const {
    debugSettings,
    setDebugSettings,
    metrics,
    history,
    state,
    setForceOCR,
  } = useSmartScan();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isBrowser()) return;

    const handleOpen = () => openDrawer();
    const handleClose = () => closeDrawer();
    const handleToggle = () => toggleDrawer();

    window.addEventListener('smartscan:debug-open', handleOpen);
    window.addEventListener('smartscan:debug-close', handleClose);
    window.addEventListener('smartscan:debug-toggle', handleToggle);

    return () => {
      window.removeEventListener('smartscan:debug-open', handleOpen);
      window.removeEventListener('smartscan:debug-close', handleClose);
      window.removeEventListener('smartscan:debug-toggle', handleToggle);
    };
  }, [closeDrawer, openDrawer, toggleDrawer]);

  useEffect(() => {
    if (!isOpen || !isBrowser()) return;

    const body = document.body;
    const originalOverflow = body.style.overflow;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    body.style.overflow = 'hidden';

    const initialFocusable = getFocusableElements(containerRef.current);
    initialFocusable[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeDrawer();
        return;
      }

      if (event.key === 'Tab') {
        const focusable = getFocusableElements(containerRef.current);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [closeDrawer, isOpen]);

  const lastErrorCodes = useMemo(() => {
    const codes = new Set<string>();
    if (state.errorCode) codes.add(state.errorCode);
    if (metrics.barcode?.errorCode) codes.add(metrics.barcode.errorCode);
    if (metrics.ocr?.errorCode) codes.add(metrics.ocr.errorCode);
    if (metrics.analysis?.errorCode) codes.add(metrics.analysis.errorCode);
    if (metrics.search?.errorCode) codes.add(metrics.search.errorCode);
    return Array.from(codes);
  }, [
    metrics.analysis?.errorCode,
    metrics.barcode?.errorCode,
    metrics.ocr?.errorCode,
    metrics.search?.errorCode,
    state.errorCode,
  ]);

  const metricsCards = [
    {
      title: 'Barcode',
      rows: [
        { label: 'Status', value: formatStatus(metrics.barcode?.status) },
        { label: 'Engine', value: metrics.barcode?.engine ?? debugSettings.engine },
        { label: 'Duration', value: formatDuration(metrics.barcode?.durationMs) },
        { label: 'Confidence', value: formatConfidence(metrics.barcode?.confidence) },
        { label: 'Last error', value: formatError(metrics.barcode?.errorCode) },
      ],
    },
    {
      title: 'OCR',
      rows: [
        { label: 'Status', value: formatStatus(metrics.ocr?.status) },
        { label: 'Duration', value: formatDuration(metrics.ocr?.durationMs) },
        { label: 'Confidence', value: formatConfidence(metrics.ocr?.confidence) },
        { label: 'Last error', value: formatError(metrics.ocr?.errorCode) },
      ],
    },
    {
      title: 'Analysis',
      rows: [
        { label: 'Status', value: formatStatus(metrics.analysis?.status) },
        { label: 'Duration', value: formatDuration(metrics.analysis?.durationMs) },
        { label: 'Source', value: metrics.analysis?.source ?? (debugSettings.useMockAnalyze ? 'mock' : 'live') },
        { label: 'Last error', value: formatError(metrics.analysis?.errorCode) },
      ],
    },
    {
      title: 'Search',
      rows: [
        { label: 'Status', value: formatStatus(metrics.search?.status) },
        { label: 'Duration', value: formatDuration(metrics.search?.durationMs) },
        { label: 'Query', value: metrics.search?.query ?? '—' },
        { label: 'Last error', value: formatError(metrics.search?.errorCode) },
      ],
    },
  ];

  if (!isBrowser()) {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-end">
      <div
        role="presentation"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={closeDrawer}
        data-focus-trap-skip
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Scan debug drawer"
        ref={containerRef}
        className="relative h-full w-full max-w-[600px] overflow-hidden rounded-l-3xl border border-border-light bg-white shadow-2xl focus:outline-none"
      >
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between border-b border-border-light px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-text-dark">Debug</h2>
              <p className="text-sm text-text-muted">Tune scan behavior and inspect live metrics.</p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-full border border-border-light p-2 text-text-muted transition hover:bg-gray-100 hover:text-text-dark"
              aria-label="Close debug drawer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid gap-6 lg:grid-cols-[minmax(220px,1fr)_minmax(0,1fr)]">
              <section aria-labelledby="debug-toggles-heading" className="space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 id="debug-toggles-heading" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                      Toggles
                    </h3>
                    <Settings2 className="h-4 w-4 text-text-muted" aria-hidden="true" />
                  </div>
                  <div className="mt-4 space-y-4">
                    <label className="flex flex-col gap-2 text-sm">
                      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Barcode engine</span>
                      <select
                        className="rounded-xl border border-border-light px-3 py-2 text-sm focus:border-brand-medical focus:outline-none focus:ring-2 focus:ring-brand-medical"
                        value={debugSettings.engine}
                        onChange={(event) => setDebugSettings({ engine: event.target.value as BarcodeEngineOption })}
                      >
                        {ENGINE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <ToggleRow
                      id="toggle-force-ocr"
                      label="Force OCR even when barcode succeeds"
                      description="Helpful for debugging OCR-only flows."
                      checked={state.forceOCR}
                      onChange={(value) => setForceOCR(value)}
                    />

                    <ToggleRow
                      id="toggle-mock-analysis"
                      label="Enable mock analysis"
                      description="Bypass API calls and return deterministic mock data."
                      checked={debugSettings.useMockAnalyze}
                      onChange={(value) => setDebugSettings({ useMockAnalyze: value })}
                    />

                    <ToggleRow
                      id="toggle-raw-json"
                      label="Show raw JSON"
                      description="Display raw payloads in the test harness panels."
                      checked={debugSettings.showRawJson}
                      onChange={(value) => setDebugSettings({ showRawJson: value })}
                    />

                    <ToggleRow
                      id="toggle-timings"
                      label="Show timing metrics"
                      description="Expose millisecond timing blocks alongside the panels."
                      checked={debugSettings.showTimings}
                      onChange={(value) => setDebugSettings({ showTimings: value })}
                    />
                  </div>
                </div>

                <footer className="rounded-xl border border-dashed border-border-light bg-gray-50 px-3 py-2 text-xs text-text-muted">
                  <p>ESC closes • Click backdrop closes • Focus is trapped while open</p>
                  <p>Panel overlays navigation and prevents background scroll.</p>
                </footer>
              </section>

              <section aria-labelledby="debug-metrics-heading" className="space-y-4">
                <h3 id="debug-metrics-heading" className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Metrics
                </h3>
                {metricsCards.map((card) => (
                  <article key={card.title} className="rounded-2xl border border-border-light bg-white shadow-sm">
                    <div className="border-b border-border-light px-4 py-3">
                      <h4 className="text-sm font-semibold text-text-dark">{card.title}</h4>
                    </div>
                    <dl className="space-y-2 px-4 py-3 text-sm text-text-secondary">
                      {card.rows.map((row) => (
                        <div key={row.label} className="flex items-start justify-between gap-3">
                          <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{row.label}</dt>
                          <dd className="flex-1 text-right text-text-dark">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}

                <div className="rounded-2xl border border-dashed border-border-light bg-gray-50 px-4 py-3 text-sm text-text-secondary">
                  <p className="font-medium text-text-dark">Recent errors</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {lastErrorCodes.length ? lastErrorCodes.join(', ') : 'None recorded in this session.'}
                  </p>
                </div>
              </section>
            </div>

            {history.length ? (
              <details className="mt-8 space-y-2 text-sm text-text-secondary">
                <summary className="cursor-pointer select-none text-sm font-medium text-text-dark">
                  Session history ({history.length})
                </summary>
                <ul className="space-y-2 text-xs">
                  {history.map((session) => (
                    <li key={session.id} className="rounded-lg border border-border-light p-2">
                      <p className="font-medium text-text-dark">
                        {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        {' • '}
                        {session.barcode?.engine ?? debugSettings.engine}
                      </p>
                      <p className="text-text-muted">
                        Barcode: {session.barcode?.code ?? '—'} • OCR: {formatConfidence(session.ocr?.confidence)} • Analysis: {session.analysis ? 'done' : '—'}
                      </p>
                      {session.errorCode ? (
                        <p className="text-red-600">{session.errorCode}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps): ReactElement {
  return (
    <label htmlFor={id} className="flex items-start justify-between gap-4 rounded-xl border border-transparent px-2 py-1 hover:border-border-light">
      <span className="flex-1">
        <span className="block text-sm font-medium text-text-dark">{label}</span>
        {description ? <span className="text-xs text-text-muted">{description}</span> : null}
      </span>
      <span className="pt-1">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 rounded border-border-light text-brand-medical focus:ring-brand-medical"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </span>
    </label>
  );
}
