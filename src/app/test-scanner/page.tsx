'use client';

import type { ReactElement } from 'react';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { SmartScanProvider, useSmartScan } from '@/components/analyze/SmartScanContext';
import { DebugDrawer } from '@/components/analyze/DebugDrawer';
import { AnalyzePanel } from '@/components/analyze/AnalyzePanel';
import { ScanPreviewPanel } from '@/components/analyze/ScanPreviewPanel';
import { ScanResultPanel } from '@/components/analyze/ScanResultPanel';
import { SearchPanel } from '@/components/analyze/SearchPanel';
import { ToastProvider } from '@/components/ui/ToastProvider';
import type { BarcodeScanResult, OCRResult } from '@/lib/types';
import { useToast } from '@/components/ui/ToastProvider';
import type { AnalysisState, OcrState, SearchState } from '@/types/analyze';

const formatBarcode = (barcode: BarcodeScanResult | null): string => {
  if (!barcode) return 'No barcode detected yet.';
  if (!barcode.ok) {
    return `Barcode error: ${barcode.errorCode ?? 'unknown'}${barcode.errorMessage ? ` – ${barcode.errorMessage}` : ''}`;
  }
  return `Barcode: ${barcode.code} (${barcode.format ?? 'unknown'}) confidence ${(barcode.confidence ?? 0).toFixed(2)}`;
};

const formatOCR = (ocr: OCRResult | null): string => {
  if (!ocr) return 'No OCR result yet.';
  if (!ocr.ok) {
    return `OCR error: ${ocr.errorCode ?? 'unknown'}${ocr.errorMessage ? ` – ${ocr.errorMessage}` : ''}`;
  }
  return `OCR confidence ${(ocr.confidence ?? 0).toFixed(2)} – ${ocr.text.slice(0, 120)}${ocr.text.length > 120 ? '…' : ''}`;
};

function SmartScanDemo(): ReactElement {
  const {
    state,
    debugSettings,
    metrics,
    runImageScan,
    startCameraScan,
    stopCameraScan,
    confirmManualText,
    reset,
    setForceOCR,
  } = useSmartScan();
  const [uploadError, setUploadError] = useState<string>('');
  const [manualDraft, setManualDraft] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (state.step === 'manual_correction') {
      setManualDraft(state.ocrResult?.text ?? '');
    } else {
      setManualDraft('');
    }
  }, [state.step, state.ocrResult?.text]);

  useEffect(() => () => {
    stopCameraScan();
    setIsCameraActive(false);
  }, [stopCameraScan]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files are supported');
      return;
    }
    setUploadError('');
    await runImageScan(file);
  };

  const handleManualSubmit = () => {
    if (!manualDraft.trim()) return;
    confirmManualText(manualDraft.trim());
  };

  const handleStartCamera = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setUploadError('Camera preview unavailable');
      showToast({ tone: 'error', title: 'Camera unavailable', description: 'Camera preview element is not ready.' });
      return;
    }
    setUploadError('');
    try {
      await startCameraScan({
        video: videoRef.current,
        canvas: canvasRef.current,
        overlay: overlayRef.current ?? undefined,
      });

      const videoElement = videoRef.current;
      if (videoElement) {
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('muted', 'true');
        videoElement.setAttribute('autoplay', 'true');
        if (!videoElement.srcObject) {
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoElement.srcObject = fallbackStream;
          } catch (streamError) {
            console.error('Unable to initialize camera stream', streamError);
            setUploadError('Unable to access the camera stream');
            showToast({ tone: 'error', title: 'Camera access denied', description: 'Please grant camera permissions and try again.' });
            return;
          }
        }
        try {
          await videoElement.play();
        } catch (playError) {
          console.warn('Camera preview could not start automatically', playError);
          showToast({ tone: 'error', title: 'Playback blocked', description: 'Tap the preview to allow camera playback.' });
        }
      }
      setIsCameraActive(true);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Unable to start camera');
      showToast({ tone: 'error', title: 'Camera error', description: error instanceof Error ? error.message : 'Unable to start the camera scan.' });
      setIsCameraActive(false);
    }
  };

  const handleStopCamera = () => {
    stopCameraScan();
    setIsCameraActive(false);
  };

  const handleToggleCamera = async () => {
    if (isCameraActive) {
      handleStopCamera();
    } else {
      await handleStartCamera();
    }
  };

  const showManual = state.step === 'manual_correction';
  const formatConfidenceMetric = (value?: number): string =>
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—';
  const now = Date.now();
  const ocrPanelState = state.ocrResult
    ? ({
        ...state.ocrResult,
        barcode: state.barcodeResult?.code ?? state.ocrResult.barcode,
      } as OcrState)
    : null;
  const analysisPanelState = state.analysisResult
    ? ({
        ...state.analysisResult,
        startedAt: metrics.analysis?.startedAt ?? now,
        completedAt: metrics.analysis?.completedAt ?? now,
        durationMs: metrics.analysis?.durationMs ?? 0,
        source: metrics.analysis?.source ?? (debugSettings.useMockAnalyze ? 'mock' : 'live'),
      } as AnalysisState)
    : null;
  const searchPanelState = state.searchResult
    ? ({
        ...state.searchResult,
        query: metrics.search?.query ?? state.searchResult.searchMeta.query,
        startedAt: metrics.search?.startedAt ?? now,
        completedAt: metrics.search?.completedAt ?? now,
        durationMs: metrics.search?.durationMs ?? 0,
      } as SearchState)
    : null;

  const ocrPanelStatus: 'pending' | 'active' | 'completed' | 'error' =
    state.errorCode === 'ocr_failed'
      ? 'error'
      : state.step === 'ocr' || state.step === 'scanning_barcode' || state.step === 'manual_correction'
        ? 'active'
        : state.ocrResult
          ? 'completed'
          : 'pending';

  const analysisPanelStatus: 'pending' | 'active' | 'completed' | 'error' =
    state.errorCode === 'analyze_failed'
      ? 'error'
      : state.step === 'analyzing'
        ? 'active'
        : state.analysisResult
          ? 'completed'
          : state.step === 'searching'
            ? 'active'
            : 'pending';

  const searchPanelStatus: 'pending' | 'active' | 'completed' | 'error' =
    state.errorCode === 'search_failed'
      ? 'error'
      : state.step === 'searching'
        ? 'active'
        : state.searchResult
          ? 'completed'
          : state.analysisResult
            ? 'active'
            : 'pending';

  const ocrErrorMessage = state.errorCode === 'ocr_failed' ? state.errorMessage : null;
  const analysisErrorMessage = state.errorCode === 'analyze_failed' ? state.errorMessage : null;
  const searchErrorMessage = state.errorCode === 'search_failed' ? state.errorMessage : null;
  const ocrProgress = Math.min(100, Math.round(metrics.ocr?.progress ?? (state.ocrResult ? 100 : 0)));
  const hasAnalysis = Boolean(analysisPanelState?.analysis);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border-light bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Smart Scan Test Harness</h1>
        <p className="text-sm text-text-secondary">Upload a supplement label image or test a live camera feed.</p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.forceOCR}
              onChange={(event) => setForceOCR(event.target.checked)}
              className="h-4 w-4 rounded border-border-light text-brand-medical focus:ring-brand-medical"
            />
            Force OCR even when barcode succeeds
          </label>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-border-light px-4 py-2 text-sm hover:bg-gray-50"
          >
            Reset
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="text-sm"
          />
          {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
        </div>
      </section>

      <section className="relative isolate rounded-3xl border border-border-light bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Camera Scanner</h2>
        <p className="text-sm text-text-secondary">Use your webcam to exercise barcode detection with automatic OCR fallback.</p>
        <div className="mt-4 flex flex-wrap gap-3 relative z-20">
          <button
            type="button"
            onClick={handleToggleCamera}
            className={
              isCameraActive
                ? 'rounded-full border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700'
                : 'rounded-full border border-gray-400 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-100'
            }
          >
            {isCameraActive ? 'Stop camera' : 'Start camera scan'}
          </button>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="relative z-0 aspect-video overflow-hidden rounded-xl border border-border-light bg-black">
            <video ref={videoRef} className="h-full w-full object-contain z-10" autoPlay playsInline muted />
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full z-20" />
            <div className="pointer-events-none absolute inset-0 z-30">
              <div className="absolute inset-x-0 top-0 h-[15%] bg-black/60" />
              <div className="absolute inset-x-0 bottom-0 h-[15%] bg-black/60" />
              <div className="absolute left-0 top-[15%] bottom-[15%] w-[15%] bg-black/60" />
              <div className="absolute right-0 top-[15%] bottom-[15%] w-[15%] bg-black/60" />
              <div className="absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.6)]" />
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </section>

      <section className="rounded-3xl border border-border-light bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Scan Status</h2>
        <div className="mt-2 space-y-2 text-sm">
          <p><span className="font-medium">Step:</span> {state.step}</p>
          <p><span className="font-medium">Progress:</span> {state.progress}%</p>
          <p><span className="font-medium">Source:</span> {state.source ?? '—'}</p>
          <p><span className="font-medium">Barcode:</span> {formatBarcode(state.barcodeResult)}</p>
          <p><span className="font-medium">OCR:</span> {formatOCR(state.ocrResult)}</p>
          {state.manualText ? (
            <p><span className="font-medium">Manual draft:</span> {state.manualText.slice(0, 120)}{state.manualText.length > 120 ? '…' : ''}</p>
          ) : null}
          {state.errorMessage ? (
            <p className="text-red-600">{state.errorMessage}</p>
          ) : null}
          {debugSettings.showTimings ? (
            <div className="mt-4 space-y-2 rounded-2xl bg-gray-50 p-3 text-xs text-text-secondary">
              <p className="text-sm font-medium text-text-dark">Timing metrics</p>
              <p>Barcode duration: {metrics.barcode?.durationMs ?? '—'} ms · Confidence: {formatConfidenceMetric(metrics.barcode?.confidence)}</p>
              <p>OCR duration: {metrics.ocr?.durationMs ?? '—'} ms · Confidence: {formatConfidenceMetric(metrics.ocr?.confidence)}</p>
              <p>Status: {metrics.ocr?.status ?? '—'}</p>
            </div>
          ) : null}
          {debugSettings.showRawJson ? (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Barcode JSON</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-black/5 p-3 text-[11px] text-slate-700">
                  {JSON.stringify(state.barcodeResult, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">OCR JSON</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-black/5 p-3 text-[11px] text-slate-700">
                  {JSON.stringify(state.ocrResult, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Analysis JSON</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-black/5 p-3 text-[11px] text-slate-700">
                  {JSON.stringify(state.analysisResult, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Search JSON</p>
                <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-black/5 p-3 text-[11px] text-slate-700">
                  {JSON.stringify(state.searchResult, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {showManual ? (
        <section className="rounded-3xl border border-dashed border-border-light bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Manual Correction</h3>
          <p className="text-sm text-text-secondary">OCR confidence was below the threshold. Review and edit the extracted text before continuing.</p>
          <textarea
            className="mt-4 w-full rounded-xl border border-border-light p-3 text-sm"
            rows={6}
            value={manualDraft}
            onChange={(event) => setManualDraft(event.target.value)}
            placeholder="Edit the OCR text here..."
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleManualSubmit}
              className="rounded-full bg-brand-medical px-4 py-2 text-sm font-medium text-white hover:bg-brand-medical/90"
            >
              Accept corrected text
            </button>
            <button
              type="button"
              onClick={() => setManualDraft(state.ocrResult?.text ?? '')}
              className="rounded-full border border-border-light px-4 py-2 text-sm hover:bg-gray-50"
            >
              Reset to OCR text
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <ScanResultPanel
            status={ocrPanelStatus}
            progress={ocrProgress}
            ocr={ocrPanelState}
            error={ocrErrorMessage}
            showRawJson={debugSettings.showRawJson}
          />
        </div>
        <div>
          {hasAnalysis ? (
            <AnalyzePanel
              status={analysisPanelStatus}
              analysis={analysisPanelState}
              error={analysisErrorMessage}
              showRawJson={debugSettings.showRawJson}
              showTimings={debugSettings.showTimings}
            />
          ) : (
            <section className="rounded-3xl border border-border-light bg-white p-6 shadow-sm">
              <header>
                <h3 className="text-lg font-semibold text-text-dark">OCR Preview</h3>
                <p className="text-sm text-text-secondary">
                  AI analysis results will appear here when available. Review the OCR output below in the meantime.
                </p>
              </header>
              <div className="mt-6">
                <ScanPreviewPanel ocr={state.ocrResult} />
              </div>
              {analysisPanelStatus === 'error' && analysisErrorMessage ? (
                <p className="mt-4 text-sm font-medium text-red-600">Analysis failed: {analysisErrorMessage}</p>
              ) : null}
            </section>
          )}
        </div>
        <div className="lg:col-span-2">
          <SearchPanel
            status={searchPanelStatus}
            results={searchPanelState}
            error={searchErrorMessage}
            showRawJson={debugSettings.showRawJson}
          />
        </div>
      </div>
    </div>
  );
}

export default function TestScannerPage(): ReactElement {
  return (
    <ToastProvider>
      <SmartScanProvider>
        <DebugDrawer />
        <main className="min-h-screen bg-bg-main py-10">
          <div className="container">
            <SmartScanDemo />
          </div>
        </main>
      </SmartScanProvider>
    </ToastProvider>
  );
}
