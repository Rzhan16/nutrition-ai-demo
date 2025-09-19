'use client';

import React, { useMemo } from 'react';

type OcrLike = {
  text?: string;
  confidence?: number; // 0–1
  data?: { text?: string; confidence?: number }; // v5 raw fallback
};

export function ScanPreviewPanel({ ocr }: { ocr?: OcrLike | null }) {
  const confidence = useMemo(() => {
    const c = ocr?.confidence ?? ocr?.data?.confidence ?? 0;
    return c > 1 ? c / 100 : c;
  }, [ocr]);

  const text = useMemo(() => ocr?.text ?? ocr?.data?.text ?? '', [ocr]);

  if (!ocr) {
    return <div className="text-sm text-text-muted">No OCR result yet.</div>;
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-2 text-sm text-text-muted">
        OCR confidence: {(confidence * 100).toFixed(1)}%
      </div>
      <pre className="whitespace-pre-wrap text-sm text-text-secondary">{text || '—'}</pre>
    </div>
  );
}
