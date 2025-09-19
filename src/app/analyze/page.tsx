'use client';

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { UploadPanel } from '@/components/analyze/UploadPanel';
import { ScanResultPanel } from '@/components/analyze/ScanResultPanel';
import { AnalyzePanel } from '@/components/analyze/AnalyzePanel';
import { SearchPanel } from '@/components/analyze/SearchPanel';
import { HistoryDrawer } from '@/components/analyze/HistoryDrawer';
import { DebugSettings } from '@/components/analyze/DebugSettings';
import { StatusStepper, type StepperItem } from '@/components/analyze/StatusStepper';
import { SearchBox } from '@/components/search/SearchBox';
import { apiClient, APIError, type AnalyzeInput } from '@/lib/api-client';
import { ocrService } from '@/lib/ocr';
import type { OCRResult } from '@/lib/types';
import { useAnalyzeState } from '@/components/analyze/useAnalyzeState';
import type { AnalysisState, OcrState, SearchState, UploadedFileInfo, HistoryEntry } from '@/types/analyze';
import { ToastProvider, useToast } from '@/components/ui/ToastProvider';
import { createTimer, generateId } from '@/lib/utils';
import { mockAnalysis } from '@/lib/mock-data';

const SEARCH_CACHE_TTL_MS = 120_000;

export default function AnalyzePage() {
  return (
    <ToastProvider>
      <AnalyzeExperience />
    </ToastProvider>
  );
}

function AnalyzeExperience() {
  const [state, dispatch] = useAnalyzeState();
  const { showToast } = useToast();

  const previewUrlRef = useRef<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef: MutableRefObject<AbortController | null> = useRef<AbortController | null>(null);
  const searchCacheRef = useRef<Map<string, { expiry: number; state: SearchState }>>(new Map());
  const timerRef = useRef(createTimer());

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      uploadAbortRef.current?.abort();
      ocrAbortRef.current?.abort();
      analyzeAbortRef.current?.abort();
      searchAbortRef.current?.abort();
    };
  }, []);

  const setUploadProgress = useCallback((value: number) => {
    dispatch({ type: 'UPLOAD_PROGRESS', value });
  }, [dispatch]);

  const setOcrProgress = useCallback((value: number) => {
    dispatch({ type: 'OCR_PROGRESS', value });
  }, [dispatch]);

  const runMockAnalyze = useCallback((ocr: OcrState): AnalysisState => {
    const cloned = JSON.parse(JSON.stringify(mockAnalysis)) as AnalysisState;
    const now = Date.now();
    cloned.supplementName = ocr.productName || cloned.supplementName;
    cloned.brand = ocr.brand || cloned.brand;
    cloned.confidence = Math.min(0.98, Math.max(ocr.confidence, cloned.confidence));
    const items = ocr.ingredients ?? [];
    cloned.ingredients = items.map((ingredient) => ({
      name: ingredient.name,
      amount: ingredient.amount ?? '',
      unit: ingredient.unit ?? '',
      dailyValue: ingredient.dailyValue ? Number.parseFloat(ingredient.dailyValue.replace('%', '')) : undefined,
    }));
    cloned.cached = false;
    cloned.scanId = `mock-${now}`;
    cloned.recommendations = cloned.recommendations ?? [];
    cloned.recommendations.unshift('Mock Analyze is enabled: results are for workflow validation.');
    cloned.analysis.primaryBenefits = `${cloned.analysis.primaryBenefits}\n\nAuto-extracted summary：${ocr.text.slice(0, 160)}${ocr.text.length > 160 ? '…' : ''}`;
    return {
      ...cloned,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      source: 'mock',
    } as AnalysisState;
  }, []);

  const extractBarcode = useCallback((text: string): string | undefined => {
    const cleaned = text.replace(/[^0-9A-Za-z\n]/g, ' ');
    const match = cleaned.match(/\b\d{12,14}\b/);
    return match?.[0];
  }, []);

  const addHistoryEntry = useCallback((
    searchState: SearchState,
    analysisState: AnalysisState | null,
  ) => {
    if (!analysisState) return;
    const entry: HistoryEntry = {
      id: generateId(),
      timestamp: Date.now(),
      upload: state.upload
        ? {
            previewUrl: state.upload.previewUrl,
            response: state.upload.response,
          }
        : undefined,
      ocr: state.ocr ?? undefined,
      analysis: analysisState,
      search: searchState,
    };
    dispatch({ type: 'ADD_HISTORY', payload: entry });
  }, [dispatch, state.ocr, state.upload]);

  const executeSearch = useCallback(async (
    query: string,
    origin: 'auto' | 'manual',
    analysisOverride?: AnalysisState | null,
  ) => {
    if (!query.trim()) {
      return;
    }
    const normalized = query.trim().toLowerCase();

    const cached = searchCacheRef.current.get(normalized);
    if (cached && cached.expiry > Date.now()) {
      dispatch({ type: 'SEARCH_SUCCESS', payload: cached.state });
      if (origin === 'auto') {
        addHistoryEntry(cached.state, analysisOverride ?? state.analysis ?? null);
      }
      showToast({ tone: 'info', title: 'Using cached results', description: `Cache hit: ${cached.state.pagination.total} records` });
      return;
    }

    dispatch({ type: 'SEARCH_START', query });

    const controller = new AbortController();
    searchAbortRef.current?.abort();
    searchAbortRef.current = controller;

    const startedAt = Date.now();
    timerRef.current.start('search');

    try {
      const response = await apiClient.searchSupplements(
        { query, limit: 8 },
        { signal: controller.signal, retries: 1, description: 'supplement search' }
      );
      const endedAt = Date.now();
      const duration = timerRef.current.end('search') || endedAt - startedAt;
      dispatch({ type: 'SET_TIMING', key: 'search', value: duration });
      const searchState: SearchState = {
        ...response,
        query,
        startedAt,
        completedAt: endedAt,
        durationMs: duration,
      };
      dispatch({ type: 'SEARCH_SUCCESS', payload: searchState });
      searchCacheRef.current.set(normalized, { state: searchState, expiry: Date.now() + SEARCH_CACHE_TTL_MS });
      if (origin === 'auto') {
        addHistoryEntry(searchState, analysisOverride ?? state.analysis ?? null);
      }
      showToast({ tone: 'success', title: origin === 'auto' ? 'Automated search complete' : 'Search complete', description: `Found ${searchState.pagination.total} results` });
    } catch (error) {
      if (error instanceof APIError && (error.code === 'ABORTED' || error.code === 'TIMEOUT')) {
        const fallbackStatus = state.search
          ? 'done'
          : state.analysis
          ? 'analyzing'
          : state.ocr
          ? 'ocr'
          : 'idle';
        dispatch({ type: 'SET_STATUS', status: fallbackStatus });
        showToast({
          tone: 'info',
          title: error.code === 'ABORTED' ? 'Search cancelled' : 'Search timeout',
          description: error.friendlyMessage,
        });
        return;
      }
      const message = error instanceof APIError ? error.friendlyMessage : 'Search failed, please try again later.';
      dispatch({ type: 'SEARCH_FAILURE', message, detail: error instanceof Error ? error.message : undefined });
      showToast({ tone: 'error', title: 'Search failed', description: message });
    } finally {
      searchAbortRef.current = null;
    }
  }, [addHistoryEntry, dispatch, showToast, state.analysis, state.ocr, state.search]);

  const runAnalysis = useCallback(async (ocr: OcrState) => {
    const useMock = state.debug.useMockAnalyze;
    dispatch({ type: 'ANALYZE_START' });

    const controller = new AbortController();
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = controller;

    const startedAt = Date.now();
    timerRef.current.start('analyze');

    try {
      let analysis: AnalysisState;
      if (useMock) {
        analysis = runMockAnalyze(ocr);
      } else {
        const input: AnalyzeInput = ocr.text
          ? { text: ocr.text }
          : state.upload?.response?.imageUrl
          ? { imageUrl: state.upload.response.imageUrl }
          : { text: '' };
        const response = await apiClient.analyzeSupplement(input, {
          signal: controller.signal,
          retries: 2,
          description: 'supplement analysis',
        });
        const endedAt = Date.now();
        const duration = timerRef.current.end('analyze') || endedAt - startedAt;
        dispatch({ type: 'SET_TIMING', key: 'analyze', value: duration });
        analysis = {
          ...response,
          startedAt,
          completedAt: endedAt,
          durationMs: duration,
          source: 'live',
        };
      }

      if (useMock) {
        const duration = timerRef.current.end('analyze') || 0;
        dispatch({ type: 'SET_TIMING', key: 'analyze', value: duration });
        analysis.durationMs = duration;
        analysis.completedAt = Date.now();
        analysis.startedAt = analysis.completedAt - duration;
      }

      dispatch({ type: 'ANALYZE_SUCCESS', payload: analysis });
      showToast({ tone: 'success', title: 'Analysis complete', description: 'AI produced the nutrition insights.' });
      await executeSearch(buildSearchQuery(analysis, ocr), 'auto', analysis);
    } catch (error) {
      if (error instanceof APIError && error.code === 'ABORTED') {
        showToast({ tone: 'info', title: 'Analysis cancelled' });
        dispatch({ type: 'SET_STATUS', status: 'ocr' });
      } else {
        const message = error instanceof APIError ? error.friendlyMessage : 'Analysis failed, please try again later.';
        dispatch({ type: 'ANALYZE_FAILURE', message, detail: error instanceof Error ? error.message : undefined });
        showToast({ tone: 'error', title: 'Analysis failed', description: message });
      }
    } finally {
      analyzeAbortRef.current = null;
    }
  }, [dispatch, executeSearch, runMockAnalyze, showToast, state.debug.useMockAnalyze, state.upload?.response?.imageUrl]);
  const runOcr = useCallback(async (file: File) => {
    dispatch({ type: 'OCR_START' });
    setOcrProgress(15);

    const controller = new AbortController();
    ocrAbortRef.current?.abort();
    ocrAbortRef.current = controller;

    const startedAt = Date.now();
    timerRef.current.start('ocr');

    try {
      const result = (await ocrService.processImage(file, {
        signal: controller.signal,
        onProgress: (value) => setOcrProgress(Math.max(value, 20)),
      })) as OCRResult;
      const barcode = extractBarcode(result.text);
      const duration = timerRef.current.end('ocr') || Date.now() - startedAt;
      dispatch({ type: 'SET_TIMING', key: 'ocr', value: duration });
      const payload: OcrState = {
        ...result,
        barcode,
        processingTime: duration,
      };
      setOcrProgress(100);
      dispatch({ type: 'OCR_SUCCESS', payload });
      showToast({ tone: 'success', title: 'OCR complete', description: 'Text recognition finished and analysis input prepared.' });

      await runAnalysis(payload);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        showToast({ tone: 'info', title: 'OCR cancelled' });
        dispatch({ type: 'SET_STATUS', status: 'idle' });
      } else {
        const message = error instanceof Error ? error.message : 'OCR processing failed';
        dispatch({ type: 'OCR_FAILURE', message, detail: error instanceof Error ? error.message : undefined });
        showToast({ tone: 'error', title: 'OCR failed', description: message });
      }
    } finally {
      ocrAbortRef.current = null;
    }
  }, [dispatch, extractBarcode, runAnalysis, setOcrProgress, showToast]);

  const handleUpload = useCallback(async (file: File) => {
    dispatch({ type: 'RESET_ERROR' });
    dispatch({ type: 'UPLOAD_START' });
    setUploadProgress(15);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;

    const controller = new AbortController();
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = controller;

    const uploadStarted = Date.now();
    timerRef.current.start('upload');

    try {
      const response = await apiClient.uploadImage(file, {
        signal: controller.signal,
        retries: 1,
        description: 'image upload',
      });

      const duration = timerRef.current.end('upload') || Date.now() - uploadStarted;
      dispatch({ type: 'SET_TIMING', key: 'upload', value: duration });
      const payload: UploadedFileInfo = {
        file,
        previewUrl,
        response,
        startedAt: uploadStarted,
        completedAt: Date.now(),
      };
      setUploadProgress(100);
      dispatch({ type: 'UPLOAD_SUCCESS', payload });
      showToast({ tone: 'success', title: 'Upload successful', description: 'Image is ready for OCR processing.' });

      await runOcr(file);
    } catch (error) {
      if (error instanceof APIError && error.code === 'ABORTED') {
        dispatch({ type: 'CLEAR_UPLOAD' });
        dispatch({ type: 'SET_STATUS', status: 'idle' });
        showToast({ tone: 'info', title: 'Upload cancelled' });
      } else {
        const message = error instanceof APIError ? error.friendlyMessage : 'Upload failed, please try again.';
        dispatch({ type: 'UPLOAD_FAILURE', message, detail: error instanceof Error ? error.message : undefined });
        showToast({ tone: 'error', title: 'Upload failed', description: message });
      }
    } finally {
      uploadAbortRef.current = null;
    }
  }, [dispatch, runOcr, setUploadProgress, showToast]);

  const handleManualSearch = useCallback(
    async (query: string) => {
      await executeSearch(query, 'manual', state.analysis);
    },
    [executeSearch, state.analysis]
  );

  const handleCancelOcr = useCallback(() => {
    ocrAbortRef.current?.abort();
  }, []);

  const handleCancelAnalysis = useCallback(() => {
    analyzeAbortRef.current?.abort();
  }, []);

  const handleCancelSearch = useCallback(() => {
    searchAbortRef.current?.abort();
  }, []);

  const handleRetryUpload = useCallback(() => {
    if (state.upload?.file) {
      handleUpload(state.upload.file);
    }
  }, [handleUpload, state.upload?.file]);

  const handleRetryOcr = useCallback(() => {
    if (state.upload?.file) {
      void runOcr(state.upload.file);
    }
  }, [runOcr, state.upload?.file]);

  const handleRetryAnalysis = useCallback(() => {
    if (state.ocr) {
      void runAnalysis(state.ocr);
    }
  }, [runAnalysis, state.ocr]);

  const handleRetrySearch = useCallback(() => {
    if (state.analysis) {
      const query = buildSearchQuery(state.analysis, state.ocr ?? null);
      void executeSearch(query, 'auto', state.analysis);
    }
  }, [executeSearch, state.analysis, state.ocr]);

  const handleSelectHistory = useCallback((entry: HistoryEntry) => {
    dispatch({ type: 'RESTORE_HISTORY', payload: entry });
  }, [dispatch]);

  const handleClearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, [dispatch]);

  const computeStepStatus = useCallback((step: 'uploading' | 'ocr' | 'analyzing' | 'searching'): StepperItem['status'] => {
    const progressMap = {
      uploading: state.progress.upload,
      ocr: state.progress.ocr,
      analyzing: state.progress.analyze,
      searching: state.progress.search,
    } as const;

    if (state.error?.step === step) {
      return 'error';
    }

    if (progressMap[step] >= 100) {
      return 'completed';
    }

    if (state.status === step) {
      return 'active';
    }

    if (['done', 'error'].includes(state.status) && progressMap[step] === 0) {
      return 'pending';
    }

    return progressMap[step] > 0 ? 'active' : 'pending';
  }, [state.error, state.progress, state.status]);

  const stepperSteps = useMemo<StepperItem[]>(() => {
    const uploadStatus = computeStepStatus('uploading');
    const ocrStatus = computeStepStatus('ocr');
    const analyzeStatus = computeStepStatus('analyzing');
    const searchStatus = computeStepStatus('searching');
    return [
      { id: 'upload', label: 'Upload', description: 'Select or drop a supplement label', status: uploadStatus },
      { id: 'ocr', label: 'OCR', description: 'Extract ingredients, brand, and barcode', status: ocrStatus },
      { id: 'analyze', label: 'AI Analysis', description: 'Generate professional nutrition conclusions', status: analyzeStatus },
      { id: 'search', label: 'Database Match', description: 'Compare against product and ingredient datasets', status: searchStatus },
      { id: 'complete', label: 'Complete', description: 'Save the record and review history', status: searchStatus === 'completed' ? 'completed' : 'pending' },
    ];
  }, [computeStepStatus]);

  const suggestions = useMemo(() => {
    const fromSearch = state.search?.suggestions?.popularSearches ?? [];
    const fromAnalysis = state.analysis?.ingredients?.slice(0, 3).map((ingredient) => ingredient.name) ?? [];
    const combined = Array.from(new Set([...fromAnalysis, ...fromSearch])).filter((value): value is string => Boolean(value));
    return combined.length ? combined : undefined;
  }, [state.analysis, state.search]);

  return (
    <div className="min-h-screen bg-bg-main pb-16">
      <div className="container py-12 text-center">
        <h1 className="text-4xl font-extrabold text-text-dark">AI Nutrition Analysis Workspace</h1>
        <p className="mt-4 text-base text-text-secondary">
          Upload a supplement label or search directly to experience the full OCR → AI analysis → database workflow.
        </p>
      </div>

      <section className="container">
        <StatusStepper steps={stepperSteps} />
      </section>

      <div className="container mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <UploadPanel
            status={stepperSteps[0].status}
            progress={state.progress.upload}
            fileInfo={state.upload}
            error={state.error?.step === 'uploading' ? state.error.message : null}
            onUpload={handleUpload}
            onCancel={uploadAbortRef.current ? () => uploadAbortRef.current?.abort() : undefined}
            onRetry={handleRetryUpload}
            disabled={state.status === 'ocr' || state.status === 'analyzing'}
          />

          <ScanResultPanel
            status={stepperSteps[1].status}
            progress={state.progress.ocr}
            ocr={state.ocr}
            error={state.error?.step === 'ocr' ? state.error.message : null}
            onRetry={handleRetryOcr}
            onCancel={handleCancelOcr}
            showRawJson={state.debug.showRawJson}
          />

          <AnalyzePanel
            status={stepperSteps[2].status}
            analysis={state.analysis}
            error={state.error?.step === 'analyzing' ? state.error.message : null}
            onRetry={handleRetryAnalysis}
            onCancel={handleCancelAnalysis}
            showRawJson={state.debug.showRawJson}
            showTimings={state.debug.showTimings}
          />

          <section className="rounded-3xl border border-border-light bg-white p-6 shadow-sm" aria-labelledby="search-box-heading">
            <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 id="search-box-heading" className="text-lg font-semibold text-text-dark">
                  Search Supplement Database
                </h3>
                <p className="text-sm text-text-secondary">Supports keywords for brand, ingredient, or barcode.</p>
              </div>
              <button
                type="button"
                className="text-xs text-text-muted hover:text-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
                onClick={handleCancelSearch}
              >
                Cancel search
              </button>
            </header>
            <SearchBox
              onSearch={handleManualSearch}
              suggestions={suggestions}
              placeholder="e.g., Pure Encapsulations, Vitamin D3, UPC"
              debounceDelay={300}
              loading={state.status === 'searching' && state.progress.search < 100}
              className="w-full"
            />
          </section>

          <SearchPanel
            status={stepperSteps[3].status}
            results={state.search}
            error={state.error?.step === 'searching' ? state.error.message : null}
            onRetry={handleRetrySearch}
            showRawJson={state.debug.showRawJson}
          />
        </div>

        <div className="flex flex-col gap-6">
          <HistoryDrawer
            history={state.history}
            activeId={state.activeHistoryId}
            onSelect={handleSelectHistory}
            onClear={handleClearHistory}
          />
          <DebugSettings
            settings={state.debug}
            onChange={(payload) => dispatch({ type: 'SET_DEBUG', payload })}
          />
        </div>
      </div>
    </div>
  );
}

function buildSearchQuery(analysis: AnalysisState, ocr: OcrState | null): string {
  const parts = [analysis.brand, analysis.supplementName];
  if (ocr?.barcode) parts.push(ocr.barcode);
  const ingredient = analysis.ingredients?.[0]?.name;
  if (ingredient) parts.push(ingredient);
  return parts.filter(Boolean).join(' ');
}
