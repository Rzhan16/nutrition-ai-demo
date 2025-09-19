'use client';

import type { DebugSettings } from '@/types/analyze';

interface DebugSettingsProps {
  settings: DebugSettings;
  onChange: (settings: Partial<DebugSettings>) => void;
}

export function DebugSettings({ settings, onChange }: DebugSettingsProps) {
  return (
    <section className="rounded-3xl border border-dashed border-border-muted bg-white/60 p-4 text-sm text-text-secondary">
      <h4 className="text-base font-semibold text-text-dark">Debug Settings</h4>
      <p className="text-xs text-text-muted">For local debugging only; does not affect production users.</p>

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border-light text-brand-medical focus:ring-brand-medical"
            checked={settings.useMockAnalyze}
            onChange={(event) => onChange({ useMockAnalyze: event.target.checked })}
          />
          <span>Enable Mock Analyze (used when no OpenAI Key is provided)</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border-light text-brand-medical focus:ring-brand-medical"
            checked={settings.showRawJson}
            onChange={(event) => onChange({ showRawJson: event.target.checked })}
          />
          <span>Show raw JSON response</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border-light text-brand-medical focus:ring-brand-medical"
            checked={settings.showTimings}
            onChange={(event) => onChange({ showTimings: event.target.checked })}
          />
          <span>Show timing details</span>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Barcode engine</p>
          <select
            className="w-full rounded-xl border border-border-light bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-medical"
            value={settings.barcodeEngine}
            onChange={(event) => onChange({ barcodeEngine: event.target.value as DebugSettings['barcodeEngine'] })}
          >
            <option value="auto">Auto (default)</option>
            <option value="quagga">QuaggaJS</option>
            <option value="zxing">ZXing</option>
            <option value="html5-qrcode">Html5-Qrcode</option>
          </select>
        </div>
      </div>
    </section>
  );
}
