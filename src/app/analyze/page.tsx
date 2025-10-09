'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
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
import type { AnalysisResponse, OCRResult } from '@/lib/types';
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
  const historyLoadedRef = useRef(false);
  const [searchStatusMessage, setSearchStatusMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (historyLoadedRef.current) {
      return;
    }
    historyLoadedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const history = await apiClient.getScanHistory({ limit: 8 }, { retries: 1, timeoutMs: 10_000 });
        if (cancelled || !history?.scans?.length) {
          return;
        }

        const scans = history.scans.slice().reverse();
        scans.forEach(scan => {
          const timestamp = new Date(scan.createdAt).getTime();
          const ocrData = (scan.ocrData ?? null) as Partial<OCRResult> | null;
          const ocrState: OcrState = {
            ok: (ocrData?.ok ?? true) && Boolean(scan.ocrText),
            text: scan.ocrText ?? ocrData?.text ?? '',
            confidence: scan.ocrConfidence ?? ocrData?.confidence ?? 0,
            durationMs: ocrData?.durationMs ?? 0,
            processingTime: ocrData?.processingTime,
            words: ocrData?.words,
            bbox: ocrData?.bbox,
            barcode: ocrData?.barcode,
            ingredients: ocrData?.ingredients ?? [],
            servingSize: ocrData?.servingSize,
            brand: ocrData?.brand,
            productName: ocrData?.productName,
            nutritionFacts: ocrData?.nutritionFacts,
            warnings: ocrData?.warnings,
            qualityMetrics: ocrData?.qualityMetrics,
            diagnostics: ocrData?.diagnostics,
            scanId: scan.id,
          };

          const analysisRaw = scan.analysis as Partial<AnalysisResponse> | null;
          const analysisState: AnalysisState | undefined = analysisRaw
            ? {
                supplementName: analysisRaw.supplementName ?? 'Unknown supplement',
                brand: analysisRaw.brand,
                confidence: analysisRaw.confidence ?? 0,
                analysis: analysisRaw.analysis ?? {
                  basicIntroduction: '',
                  primaryBenefits: '',
                  rdaGuidelines: '',
                  safetyLimits: '',
                  dietarySources: '',
                  supplementForms: '',
                  usageScenarios: '',
                  risksPrecautions: '',
                },
                ingredients: analysisRaw.ingredients ?? [],
                warnings: analysisRaw.warnings ?? [],
                recommendations: analysisRaw.recommendations ?? [],
                references: analysisRaw.references ?? [],
                scanId: scan.id,
                supplementId: analysisRaw.supplementId,
                cached: Boolean(analysisRaw.cached),
                ocrConfidence: analysisRaw.ocrConfidence ?? (ocrData?.confidence ?? scan.ocrConfidence ?? 0),
                analysisMethod: analysisRaw.analysisMethod,
                sources: analysisRaw.sources ?? [],
                startedAt: timestamp,
                completedAt: timestamp,
                durationMs: 0,
                source: 'live',
              }
            : undefined;

          dispatch({
            type: 'ADD_HISTORY',
            payload: {
              id: scan.id,
              timestamp,
              ocr: ocrState,
              analysis: analysisState,
            },
          });
        });
      } catch (error) {
        console.warn('Failed to load scan history', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

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
    const historyId = analysisState.scanId ?? generateId();
    const entry: HistoryEntry = {
      id: historyId,
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
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchStatusMessage(null);
      return;
    }

    const normalized = trimmedQuery.toLowerCase();
    console.log('[DEBUG] executeSearch start', { origin, query: trimmedQuery, analysisOverride: Boolean(analysisOverride) });
    setSearchStatusMessage(null);

    const cached = searchCacheRef.current.get(normalized);
    if (cached && cached.expiry > Date.now()) {
      console.log('[DEBUG] executeSearch cache hit', { origin, query: trimmedQuery, total: cached.state.pagination.total });
      setSearchStatusMessage(cached.state.supplements.length === 0 ? '无结果/重试' : null);
      dispatch({ type: 'SEARCH_SUCCESS', payload: cached.state });
      if (origin === 'auto') {
        addHistoryEntry(cached.state, analysisOverride ?? state.analysis ?? null);
      }
      showToast({ tone: 'info', title: 'Using cached results', description: `Cache hit: ${cached.state.pagination.total} records` });
      console.log('[DEBUG] executeSearch end', { origin, query: trimmedQuery, source: 'cache' });
      return;
    }

    dispatch({ type: 'SEARCH_START', query: trimmedQuery });

    const controller = new AbortController();
    searchAbortRef.current?.abort();
    searchAbortRef.current = controller;

    const startedAt = Date.now();
    timerRef.current.start('search');

    console.log('[DEBUG] executeSearch request', {
      origin,
      params: { query: trimmedQuery, limit: 8 },
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await apiClient.searchSupplements(
        { query: trimmedQuery, limit: 8 },
        { signal: controller.signal, retries: 1, description: 'supplement search' }
      );
      const endedAt = Date.now();
      const duration = timerRef.current.end('search') || endedAt - startedAt;
      dispatch({ type: 'SET_TIMING', key: 'search', value: duration });
      const searchState: SearchState = {
        ...response,
        query: trimmedQuery,
        startedAt,
        completedAt: endedAt,
        durationMs: duration,
      };
      setSearchStatusMessage(searchState.supplements.length === 0 ? '无结果/重试' : null);
      dispatch({ type: 'SEARCH_SUCCESS', payload: searchState });
      searchCacheRef.current.set(normalized, { state: searchState, expiry: Date.now() + SEARCH_CACHE_TTL_MS });
      if (origin === 'auto') {
        addHistoryEntry(searchState, analysisOverride ?? state.analysis ?? null);
      }
      showToast({ tone: 'success', title: origin === 'auto' ? 'Automated search complete' : 'Search complete', description: `Found ${searchState.pagination.total} results` });
      console.log('[DEBUG] executeSearch success', {
        origin,
        query: trimmedQuery,
        total: searchState.pagination.total,
        durationMs: duration,
      });
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
        console.log('[DEBUG] executeSearch cancelled', { origin, query: trimmedQuery, code: error.code });
        return;
      }
      setSearchStatusMessage('无结果/重试');
      console.error('[DEBUG] executeSearch error', error);
      const message = error instanceof APIError ? error.friendlyMessage : 'Search failed, please try again later.';
      dispatch({ type: 'SEARCH_FAILURE', message, detail: error instanceof Error ? error.message : undefined });
      showToast({ tone: 'error', title: 'Search failed', description: message });
    } finally {
      searchAbortRef.current = null;
      console.log('[DEBUG] executeSearch end', { origin, query: trimmedQuery, source: 'network' });
    }
  }, [addHistoryEntry, dispatch, setSearchStatusMessage, showToast, state.analysis, state.ocr, state.search]);

  const runAnalysis = useCallback(async (ocr: OcrState) => {
    const useMock = state.debug.useMockAnalyze;
    dispatch({ type: 'ANALYZE_START' });

    const controller = new AbortController();
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = controller;

    const startedAt = Date.now();
    timerRef.current.start('analyze');

    try {
      let analysis: AnalysisState | null = null;
      let autoQuery = '';
      let apiResult: Awaited<ReturnType<typeof apiClient.analyzeSupplementDetailed>> | null = null;

      if (useMock) {
        analysis = runMockAnalyze(ocr);
        const duration = timerRef.current.end('analyze') || 0;
        analysis.durationMs = duration;
        analysis.completedAt = Date.now();
        analysis.startedAt = analysis.completedAt - duration;
        dispatch({ type: 'SET_TIMING', key: 'analyze', value: duration });
        dispatch({ type: 'ANALYZE_SUCCESS', payload: analysis });
        showToast({ tone: 'success', title: 'Analysis complete', description: 'Mock analysis generated results.' });
        autoQuery = buildSearchQuery(analysis, ocr);
      } else {
        const baseInput =
          ocr.text && ocr.text.trim().length > 0
            ? { text: ocr.text, imageUrl: state.upload?.response?.imageUrl }
            : state.upload?.response?.imageUrl
            ? { imageUrl: state.upload.response.imageUrl }
            : { text: '' };

        const sanitizedOcrResult = ocr
          ? (JSON.parse(JSON.stringify(ocr)) as Partial<OCRResult>)
          : undefined;
        const input: AnalyzeInput = {
          ...baseInput,
          ...(ocr.scanId ? { scanId: ocr.scanId } : {}),
          userId: 'anonymous',
          ...(sanitizedOcrResult ? { ocrResult: sanitizedOcrResult } : {}),
        };
        apiResult = await apiClient.analyzeSupplementDetailed(input, {
          signal: controller.signal,
          retries: 2,
          description: 'supplement analysis',
        });
        const endedAt = Date.now();
        const duration = timerRef.current.end('analyze') || endedAt - startedAt;
        dispatch({ type: 'SET_TIMING', key: 'analyze', value: duration });

        autoQuery = typeof apiResult?.searchMeta?.query === 'string' ? apiResult.searchMeta.query.trim() : '';

        if (apiResult.ok && apiResult.analysis) {
          analysis = {
            ...apiResult.analysis,
            startedAt,
            completedAt: endedAt,
            durationMs: duration,
            source: 'live',
          };
          dispatch({ type: 'ANALYZE_SUCCESS', payload: analysis });
          showToast({ tone: 'success', title: 'Analysis complete', description: 'AI produced the nutrition insights.' });
        } else {
          const message = apiResult?.message ?? 'No supplement match found';
          dispatch({ type: 'ANALYZE_FAILURE', message, detail: undefined });
          showToast({
            tone: 'info',
            title: '未匹配到补充剂',
            description: message,
          });
        }
      }

      const fallbackMatch =
        apiResult?.matches && apiResult.matches.length > 0
          ? `${apiResult.matches[0].brand ?? ''} ${apiResult.matches[0].name ?? ''}`.trim()
          : '';
      const finalQuery =
        autoQuery ||
        buildSearchQuery(analysis, ocr, apiResult?.searchMeta?.normalized ?? fallbackMatch);

      if (finalQuery) {
        console.log('[DEBUG] runAnalysis auto search payload', {
          query: finalQuery,
          source: autoQuery ? 'api' : 'fallback',
          analysis: Boolean(analysis),
        });
        await executeSearch(finalQuery, 'auto', analysis);
        console.log('[DEBUG] runAnalysis auto search complete', { query: finalQuery });
      } else {
        console.warn('[DEBUG] runAnalysis skipped auto-search: no query derived');
      }
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

      let persistedScanId: string | undefined;
      const normalizedText = result.text?.trim() ?? '';
      if (normalizedText.length > 0) {
        try {
          const sanitizedForStorage = JSON.parse(
            JSON.stringify({ ...result, scanId: undefined })
          ) as Partial<OCRResult>;
          const persisted = await apiClient.createScan(
            {
              imageUrl: state.upload?.response?.imageUrl,
              ocrText: normalizedText,
              ocrConfidence: result.confidence,
              ocrResult: sanitizedForStorage,
              userId: 'anonymous',
            },
            { retries: 1, description: 'persist scan' }
          );
          persistedScanId = persisted.scan.id;
        } catch (persistError) {
          console.warn('Failed to persist OCR scan', persistError);
        }
      }

      const barcode = extractBarcode(result.text);
      const duration = timerRef.current.end('ocr') || Date.now() - startedAt;
      dispatch({ type: 'SET_TIMING', key: 'ocr', value: duration });
      const payload: OcrState = {
        ...result,
        barcode,
        processingTime: duration,
        scanId: persistedScanId ?? result.scanId,
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
  }, [dispatch, extractBarcode, runAnalysis, setOcrProgress, showToast, state.upload?.response?.imageUrl]);

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
    const query =
      state.search?.query ||
      buildSearchQuery(state.analysis, state.ocr ?? null);
    if (query && query.trim()) {
      void executeSearch(query, 'auto', state.analysis);
    } else {
      showToast({ tone: 'info', title: '无法重新搜索', description: '缺少可用的搜索关键字。' });
    }
  }, [executeSearch, showToast, state.analysis, state.ocr, state.search?.query]);

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

  const searchError = state.error?.step === 'searching';
  const showSearchStatusNotice = Boolean(searchStatusMessage);
  const searchStatusTitle = searchError ? '搜索出现问题' : '未找到匹配结果';
  const searchStatusDescription = searchStatusMessage ?? (searchError ? '搜索失败，请重试' : '无结果/重试');
  const searchPanelStatus = searchError ? 'error' : stepperSteps[3].status;

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
              loading={state.status === 'searching'}
              className="w-full"
            />
          </section>

          {showSearchStatusNotice ? (
            <section className="rounded-3xl border border-dashed border-border-muted bg-white p-6 shadow-sm" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-text-dark">{searchStatusTitle}</h4>
                  <p className="mt-1 text-sm text-text-secondary">{searchStatusDescription}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-border-light px-4 py-2 text-sm font-medium text-text-dark transition hover:border-brand-medical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
                  onClick={handleRetrySearch}
                >
                  重试搜索
                </button>
              </div>
            </section>
          ) : null}

          <SearchPanel
            status={searchPanelStatus}
            results={
              showSearchStatusNotice && (!state.search || state.search.supplements.length === 0)
                ? null
                : state.search
            }
            error={searchError ? searchStatusDescription : null}
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

function buildSearchQuery(analysis: AnalysisState | null, ocr: OcrState | null, fallback?: string): string {
  const parts = new Set<string>();
  if (analysis?.brand) parts.add(analysis.brand);
  if (analysis?.supplementName) parts.add(analysis.supplementName);
  if (ocr?.barcode) parts.add(ocr.barcode);
  const ingredient = analysis?.ingredients?.[0]?.name;
  if (ingredient) parts.add(ingredient);
  if (fallback) parts.add(fallback);

  const query = Array.from(parts)
    .map(part => part.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (query) {
    return query;
  }

  if (ocr?.text) {
    const tokens = ocr.text.split(/\s+/).filter(Boolean).slice(0, 6);
    if (tokens.length) {
      return tokens.join(' ');
    }
  }

  return '';
}
