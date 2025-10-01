'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  useEffect,
  type MutableRefObject,
} from 'react';
import type { ReactNode, ReactElement } from 'react';
import type {
  AnalysisResponse,
  BarcodeEngineOption,
  BarcodeErrorCode,
  BarcodeScanResult,
  OCRResult,
  ScanSource,
  SearchResponse,
  SmartScanStep,
} from '@/lib/types';
import { BarcodeDecodeLoop, BarcodeService } from '@/lib/barcode';
import { ocrService } from '@/lib/ocr';
import { APIError, apiClient, type AnalyzeInput } from '@/lib/api-client';
import { mockAnalysis } from '@/lib/mock-data';
import { generateId } from '@/lib/utils';
import { useToast } from '@/components/ui/ToastProvider';
import { dsldSearch, dsldGetLabel } from '@/lib/dsld/client';
import type { DsldLabel, DsldSearchHit, DsldSearchResult } from '@/lib/dsld/types';

const DSLD_ENABLED = process.env.NEXT_PUBLIC_DSLD_ENABLED === 'true';

type DsldIngredientRow = {
  name?: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  category?: string | null;
  dvPercent?: number | null;
};

type DsldNormalized = {
  fullName?: string;
  brandName?: string;
  upcSku?: string;
  ingredientRows?: DsldIngredientRow[];
};

interface DsldState {
  status: 'idle' | 'loading' | 'success' | 'error';
  query?: string;
  mode?: 'barcode' | 'text';
  matchId?: string;
  data: DsldNormalized | null;
  error?: string;
}

const createInitialDsldState = (): DsldState => ({
  status: 'idle',
  data: null,
});

interface SmartScanState {
  step: SmartScanStep;
  progress: number;
  source: ScanSource | null;
  barcodeResult: BarcodeScanResult | null;
  ocrResult: OCRResult | null;
  analysisResult: AnalysisResponse | null;
  searchResult: SearchResponse | null;
  file: File | null;
  errorCode?: BarcodeErrorCode | OCRResult['errorCode'];
  errorMessage?: string;
  forceOCR: boolean;
  manualText?: string;
  dsld: DsldState;
}

const initialState: SmartScanState = {
  step: 'idle',
  progress: 0,
  source: null,
  barcodeResult: null,
  ocrResult: null,
  analysisResult: null,
  searchResult: null,
  file: null,
  forceOCR: false,
  dsld: createInitialDsldState(),
};

interface StartCameraPayload {
  type: 'START_CAMERA';
}

interface StartImagePayload {
  type: 'START_IMAGE';
  file: File;
}

interface BarcodeSuccessPayload {
  type: 'BARCODE_SUCCEEDED';
  result: BarcodeScanResult;
}

interface BarcodeFailurePayload {
  type: 'BARCODE_FAILED';
  result?: BarcodeScanResult;
}

interface OcrSuccessPayload {
  type: 'OCR_SUCCEEDED';
  result: OCRResult;
}

interface OcrLowConfidencePayload {
  type: 'OCR_LOW_CONFIDENCE';
  result: OCRResult;
}

interface OcrFailurePayload {
  type: 'OCR_FAILED';
  result: OCRResult;
}

interface AnalyzeStartPayload {
  type: 'ANALYZE_START';
}

interface AnalyzeSuccessPayload {
  type: 'ANALYZE_SUCCESS';
  result: AnalysisResponse;
}

interface AnalyzeFailurePayload {
  type: 'ANALYZE_FAILURE';
  errorMessage: string;
}

interface SearchSuccessPayload {
  type: 'SEARCH_SUCCESS';
  result: SearchResponse;
}

interface SearchFailurePayload {
  type: 'SEARCH_FAILURE';
  errorMessage: string;
}

interface ResetPayload {
  type: 'RESET';
}

interface SetForceOCRPayload {
  type: 'SET_FORCE_OCR';
  value: boolean;
}

interface ErrorPayload {
  type: 'ERROR';
  errorCode?: SmartScanState['errorCode'];
  errorMessage?: string;
}

interface DsldResetPayload {
  type: 'DSLD_RESET';
}

interface DsldLoadingPayload {
  type: 'DSLD_LOADING';
  query: string;
  mode: 'barcode' | 'text';
}

interface DsldSuccessPayload {
  type: 'DSLD_SUCCESS';
  query: string;
  mode: 'barcode' | 'text';
  matchId?: string;
  data: DsldNormalized | null;
}

interface DsldErrorPayload {
  type: 'DSLD_ERROR';
  query: string;
  error: string;
}

type SmartScanAction =
  | StartCameraPayload
  | StartImagePayload
  | BarcodeSuccessPayload
  | BarcodeFailurePayload
  | OcrSuccessPayload
  | OcrLowConfidencePayload
  | OcrFailurePayload
  | AnalyzeStartPayload
  | AnalyzeSuccessPayload
  | AnalyzeFailurePayload
  | SearchSuccessPayload
  | SearchFailurePayload
  | ResetPayload
  | SetForceOCRPayload
  | ErrorPayload
  | DsldResetPayload
  | DsldLoadingPayload
  | DsldSuccessPayload
  | DsldErrorPayload;

const smartScanReducer = (state: SmartScanState, action: SmartScanAction): SmartScanState => {
  switch (action.type) {
    case 'RESET':
      return { ...initialState, forceOCR: state.forceOCR, dsld: createInitialDsldState() };
    case 'SET_FORCE_OCR':
      return { ...state, forceOCR: action.value };
    case 'START_CAMERA':
      return {
        ...state,
        step: 'scanning_barcode',
        progress: 10,
        source: 'camera',
        barcodeResult: null,
        ocrResult: null,
        analysisResult: null,
        searchResult: null,
        dsld: createInitialDsldState(),
        file: null,
        manualText: undefined,
        errorCode: undefined,
        errorMessage: undefined,
      };
    case 'START_IMAGE':
      return {
        ...state,
        step: 'scanning_barcode',
        progress: 10,
        source: 'image',
        file: action.file,
        barcodeResult: null,
        ocrResult: null,
        analysisResult: null,
        searchResult: null,
        dsld: createInitialDsldState(),
        manualText: undefined,
        errorCode: undefined,
        errorMessage: undefined,
      };
    case 'BARCODE_SUCCEEDED':
      return {
        ...state,
        barcodeResult: action.result,
        ocrResult: null,
        analysisResult: null,
        searchResult: null,
        dsld: createInitialDsldState(),
        manualText: undefined,
        step: state.forceOCR ? 'ocr' : 'analyzing',
        progress: state.forceOCR ? 30 : 55,
        errorCode: undefined,
        errorMessage: undefined,
      };
    case 'BARCODE_FAILED':
      return {
        ...state,
        barcodeResult: action.result ?? null,
        analysisResult: null,
        searchResult: null,
        dsld: createInitialDsldState(),
        step: 'ocr',
        progress: 20,
        errorCode: action.result?.errorCode,
        errorMessage: action.result?.errorMessage,
      };
    case 'OCR_SUCCEEDED':
      return {
        ...state,
        ocrResult: action.result,
        analysisResult: null,
        searchResult: null,
        dsld: createInitialDsldState(),
        manualText: undefined,
        step: 'analyzing',
        progress: 60,
        errorCode: undefined,
        errorMessage: undefined,
      };
    case 'OCR_LOW_CONFIDENCE':
      return {
        ...state,
        ocrResult: action.result,
        analysisResult: null,
        searchResult: null,
        dsld: createInitialDsldState(),
        manualText: action.result.text,
        step: 'manual_correction',
        progress: 50,
        errorCode: 'ocr_low_confidence',
        errorMessage: 'OCR confidence below threshold',
      };
    case 'OCR_FAILED':
      return {
        ...state,
        ocrResult: action.result,
        analysisResult: null,
        searchResult: null,
        dsld: createInitialDsldState(),
        step: 'error',
        progress: 40,
        errorCode: action.result.errorCode,
        errorMessage: action.result.errorMessage,
      };
    case 'ANALYZE_START':
      return {
        ...state,
        step: 'analyzing',
        progress: 70,
        analysisResult: null,
        searchResult: null,
        errorCode: undefined,
        errorMessage: undefined,
      };
    case 'ANALYZE_SUCCESS':
      return {
        ...state,
        analysisResult: action.result,
        step: 'searching',
        progress: 85,
      };
    case 'ANALYZE_FAILURE':
      return {
        ...state,
        step: 'error',
        progress: 70,
        errorCode: 'analyze_failed',
        errorMessage: action.errorMessage,
      };
    case 'SEARCH_SUCCESS':
      return {
        ...state,
        searchResult: action.result,
        step: 'done',
        progress: 100,
      };
    case 'SEARCH_FAILURE':
      return {
        ...state,
        step: 'error',
        progress: 85,
        errorCode: 'search_failed',
        errorMessage: action.errorMessage,
      };
    case 'ERROR':
      return {
        ...state,
        step: 'error',
        progress: state.progress,
        errorCode: action.errorCode,
        errorMessage: action.errorMessage,
      };
    case 'DSLD_RESET':
      return { ...state, dsld: createInitialDsldState() };
    case 'DSLD_LOADING':
      return {
        ...state,
        dsld: {
          status: 'loading',
          query: action.query,
          mode: action.mode,
          matchId: undefined,
          data: null,
          error: undefined,
        },
      };
    case 'DSLD_SUCCESS':
      return {
        ...state,
        dsld: {
          status: 'success',
          query: action.query,
          mode: action.mode,
          matchId: action.matchId,
          data: action.data,
          error: undefined,
        },
      };
    case 'DSLD_ERROR':
      return {
        ...state,
        dsld: {
          status: 'error',
          query: action.query,
          mode: state.dsld.mode,
          matchId: state.dsld.matchId,
          data: state.dsld.data,
          error: action.error,
        },
      };
    default:
      return state;
  }
};

interface DebugSettingsState {
  engine: BarcodeEngineOption;
  showRawJson: boolean;
  showTimings: boolean;
  useMockAnalyze: boolean;
}

interface SmartScanMetrics {
  barcode?: {
    durationMs?: number;
    confidence?: number;
    engine?: string;
    errorCode?: string;
    status?: string;
  };
  ocr?: {
    durationMs?: number;
    confidence?: number;
    errorCode?: string;
    progress?: number;
    status?: string;
  };
  analysis?: {
    durationMs?: number;
    status?: string;
    errorCode?: string;
    startedAt?: number;
    completedAt?: number;
    source?: 'mock' | 'live';
  };
  search?: {
    durationMs?: number;
    status?: string;
    errorCode?: string;
    startedAt?: number;
    completedAt?: number;
    query?: string;
  };
}

interface SmartScanSession {
  id: string;
  timestamp: number;
  barcode?: BarcodeScanResult | null;
  ocr?: OCRResult | null;
  analysis?: AnalysisResponse | null;
  search?: SearchResponse | null;
  errorCode?: string;
  errorMessage?: string;
}

interface SmartScanContextValue {
  state: SmartScanState;
  debugSettings: DebugSettingsState;
  setDebugSettings: (updates: Partial<DebugSettingsState>) => void;
  metrics: SmartScanMetrics;
  history: SmartScanSession[];
  runImageScan: (file: File) => Promise<void>;
  startCameraScan: (options: { video: HTMLVideoElement; canvas: HTMLCanvasElement; overlay?: HTMLCanvasElement }) => Promise<void>;
  stopCameraScan: () => void;
  confirmManualText: (text: string) => Promise<void>;
  reset: () => void;
  setForceOCR: (value: boolean) => void;
}

const SmartScanContext = createContext<SmartScanContextValue | undefined>(undefined);

export const useSmartScan = (): SmartScanContextValue => {
  const context = useContext(SmartScanContext);
  if (!context) {
    throw new Error('useSmartScan must be used within SmartScanProvider');
  }
  return context;
};

const canvasToFile = async (canvas: HTMLCanvasElement, name: string): Promise<File> => {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Failed to capture frame'));
      }
    }, 'image/png');
  });
  return new File([blob], name, { type: blob.type });
};

const createMockAnalysis = (
  text: string,
  barcode?: BarcodeScanResult | null,
): AnalysisResponse => {
  const base = structuredClone(mockAnalysis) as AnalysisResponse;
  const firstMeaningfulLine = text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  const supplementName = firstMeaningfulLine?.slice(0, 60) || base.supplementName || 'Supplement';
  const brand = barcode?.code ? `Scan ${barcode.code}` : base.brand;
  const autoSummary = text.trim()
    ? `Auto summary from OCR: ${text.slice(0, 160)}${text.length > 160 ? '…' : ''}`
    : '';

  return {
    ...base,
    supplementName,
    brand,
    confidence: 0.8,
    cached: false,
    scanId: `mock-${Date.now()}`,
    analysisMethod: 'mock_analysis',
    sources: ['mock_data'],
    ocrConfidence: base.ocrConfidence ?? 0.85,
    analysis: {
      ...base.analysis,
      basicIntroduction: base.analysis.basicIntroduction || 'Mock analysis',
      primaryBenefits: autoSummary
        ? `${base.analysis.primaryBenefits}\n\n${autoSummary}`.trim()
        : base.analysis.primaryBenefits,
    },
    ingredients: Array.isArray(base.ingredients) ? [...base.ingredients] : [],
    recommendations: Array.isArray(base.recommendations) ? [...base.recommendations] : [],
    warnings: Array.isArray(base.warnings) ? [...base.warnings] : [],
  };
};

const buildSearchQuery = (
  analysis: AnalysisResponse | null,
  barcode: BarcodeScanResult | null,
  text: string | undefined,
): string => {
  const tokens = new Set<string>();
  if (barcode?.code) tokens.add(barcode.code);
  if (analysis?.brand) tokens.add(analysis.brand);
  if (analysis?.supplementName) tokens.add(analysis.supplementName);

  const extractFirstToken = (value: string | string[] | undefined): string | undefined => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.find(Boolean);
    const segments = value
      .split(/[,;·•\-]/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    return segments[0];
  };

  const supplementFormToken = extractFirstToken(analysis?.analysis?.supplementForms);
  if (supplementFormToken) tokens.add(supplementFormToken);

  const dietarySourceToken = extractFirstToken(analysis?.analysis?.dietarySources);
  if (dietarySourceToken) tokens.add(dietarySourceToken);

  if (analysis?.ingredients?.length) {
    const firstIngredient = analysis.ingredients[0]?.name?.trim();
    if (firstIngredient) tokens.add(firstIngredient);
  }
  if (!tokens.size && text) {
    const firstLine = text.split('\n')[0];
    if (firstLine) tokens.add(firstLine.slice(0, 60));
  }
  if (!tokens.size) tokens.add('supplement');
  return Array.from(tokens).join(' ');
};



interface DsldQueryContext {
  value: string;
  mode: 'barcode' | 'text';
  digitsOnly?: string;
}

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const extractDigits = (value: string): string => value.replace(/[^0-9]/g, '');

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;

const getStringValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const getNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number.parseFloat(value.replace(/[^0-9.\-]/g, ''));
    return Number.isNaN(numeric) ? null : numeric;
  }
  return null;
};

const deriveDsldQuery = (
  barcode: BarcodeScanResult | null,
  ocr: OCRResult | null,
): DsldQueryContext | null => {
  const barcodeCandidates = [
    barcode?.ok ? barcode?.code : undefined,
    ocr?.barcode,
  ];
  const barcodeValue = barcodeCandidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length > 0);

  if (barcodeValue) {
    const digits = extractDigits(barcodeValue);
    if (digits.length >= 8 && digits.length <= 18) {
      return { value: barcodeValue, mode: 'barcode', digitsOnly: digits };
    }
  }

  if (!ocr || !ocr.ok) {
    return null;
  }

  const parts: string[] = [];
  if (ocr.brand) parts.push(ocr.brand);
  if (ocr.productName && ocr.productName !== ocr.brand) parts.push(ocr.productName);
  const combined = parts.join(' ');

  const fallback = (() => {
    if (combined.trim()) {
      return combined;
    }
    if (ocr.text) {
      const firstMeaningful = ocr.text
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean);
      return firstMeaningful ?? ocr.text;
    }
    return '';
  })();

  const normalized = collapseWhitespace(fallback).slice(0, 120);
  if (!normalized) {
    return null;
  }

  return { value: normalized, mode: 'text' };
};

const pickBestDsldHit = (
  result: DsldSearchResult | undefined,
  query: DsldQueryContext,
): DsldSearchHit | null => {
  const hits = Array.isArray(result?.hits) ? (result?.hits as DsldSearchHit[]) : [];

  if (!hits.length) {
    return null;
  }

  if (query.mode === 'barcode') {
    const digits = query.digitsOnly ?? extractDigits(query.value);
    if (digits) {
      const exact = hits.find((hit) => {
        const upcSku = getStringValue(toRecord(hit._source)?.['upcSku']);
        return upcSku ? extractDigits(upcSku) === digits : false;
      });
      if (exact) {
        return exact;
      }
    }
    return hits[0] ?? null;
  }

  const normalizedQuery = query.value.toLowerCase();
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  let bestHit: DsldSearchHit | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const hit of hits) {
    const source = toRecord(hit._source);
    const fullName = getStringValue(source?.['fullName']) ?? '';
    const brandName = getStringValue(source?.['brandName']) ?? '';
    const combined = `${brandName} ${fullName}`.trim();
    const combinedLower = combined.toLowerCase();

    let score = typeof hit._score === 'number' ? hit._score : 0;

    if (combinedLower.includes(normalizedQuery)) score += 30;
    if (fullName.toLowerCase().includes(normalizedQuery)) score += 15;
    if (brandName.toLowerCase().includes(normalizedQuery)) score += 10;

    if (queryTokens.length) {
      const combinedTokens = combinedLower.split(/\s+/).filter(Boolean);
      const combinedSet = new Set(combinedTokens);
      let overlapScore = 0;
      for (const token of queryTokens) {
        if (token.length <= 2) continue;
        if (combinedSet.has(token)) {
          overlapScore += 6;
        } else if (combinedLower.includes(token)) {
          overlapScore += 2;
        }
      }
      score += overlapScore;
    }

    if (score > bestScore) {
      bestScore = score;
      bestHit = hit;
    }
  }

  return bestHit;
};

const normalizeDsldLabel = (label: DsldLabel | null | undefined): DsldNormalized => {
  const record = toRecord(label);
  if (!record) {
    return {};
  }

  const normalized: DsldNormalized = {};
  const fullName = getStringValue(record['fullName']);
  if (fullName) normalized.fullName = fullName;

  const brandName = getStringValue(record['brandName']);
  if (brandName) normalized.brandName = brandName;

  const upcSku = getStringValue(record['upcSku']);
  if (upcSku) normalized.upcSku = upcSku;

  const rows = Array.isArray(record['ingredientRows']) ? (record['ingredientRows'] as unknown[]) : [];
  const normalizedRows: DsldIngredientRow[] = [];

  for (const rawRow of rows) {
    const rowRecord = toRecord(rawRow);
    if (!rowRecord) continue;
    const quantityArray = Array.isArray(rowRecord['quantity']) ? (rowRecord['quantity'] as unknown[]) : [];
    const quantityRecord = toRecord(quantityArray[0]);
    const dvGroups = Array.isArray(quantityRecord?.['dailyValueTargetGroup'])
      ? (quantityRecord?.['dailyValueTargetGroup'] as unknown[])
      : [];
    const dvRecord = toRecord(dvGroups[0]);

    const quantityValue = getNumberValue(quantityRecord?.['quantity']);
    const unitValue = getStringValue(quantityRecord?.['unit']);
    const notesValue = getStringValue(rowRecord['notes']);
    const categoryValue = getStringValue(rowRecord['category']);
    const dvPercent = getNumberValue(dvRecord?.['percent']);

    const ingredientRow: DsldIngredientRow = {
      name: getStringValue(rowRecord['name']),
      quantity: quantityValue,
      unit: unitValue ?? null,
      notes: notesValue ?? null,
      category: categoryValue ?? null,
      dvPercent,
    };

    if (
      ingredientRow.name ||
      ingredientRow.quantity !== null ||
      ingredientRow.unit ||
      ingredientRow.notes ||
      ingredientRow.category ||
      ingredientRow.dvPercent !== null
    ) {
      normalizedRows.push(ingredientRow);
    }
  }

  if (normalizedRows.length) {
    normalized.ingredientRows = normalizedRows;
  }

  return normalized;
};
const toCanonicalBarcodeError = (code?: string): BarcodeErrorCode | 'barcode_failed' | undefined => {
  switch (code) {
    case 'timeout':
    case 'barcode_timeout':
    case 'camera_timeout':
      return 'barcode_timeout';
    case 'unsupported':
    case 'barcode_unsupported':
    case 'unsupported_format':
      return 'barcode_unsupported';
    case 'not_allowed':
    case 'camera_permission_denied':
      return 'camera_permission_denied';
    case 'camera_not_found':
      return 'camera_not_found';
    case 'not_found':
      return 'barcode_failed';
    case 'other':
      return 'barcode_failed';
    case undefined:
      return undefined;
    default:
      return 'barcode_failed';
  }
};

const normalizeBarcodeResult = (result: BarcodeScanResult): BarcodeScanResult => {
  if (result.ok) {
    return result;
  }
  const canonical = toCanonicalBarcodeError(result.errorCode);
  if (!canonical) {
    return { ...result, errorCode: 'barcode_failed' };
  }
  if (result.errorCode === canonical) {
    return result;
  }
  return { ...result, errorCode: canonical };
};

const describeBarcodeError = (code?: string): string => {
  switch (code) {
    case 'barcode_timeout':
    case 'timeout':
      return 'Barcode detection timed out. Hold steady or adjust lighting and try again.';
    case 'barcode_unsupported':
    case 'unsupported':
      return 'Barcode format is not supported. Try switching engines in the debug drawer.';
    case 'camera_permission_denied':
    case 'not_allowed':
      return 'Camera access was denied. Allow camera permissions and retry the scan.';
    case 'camera_not_found':
      return 'Camera device not found. Connect a camera or refresh the page.';
    case 'not_found':
      return 'Unable to detect a barcode. Capture a clearer frame and retry.';
    case 'barcode_failed':
    case 'other':
    default:
      return 'Unable to detect a barcode. Capture a clearer frame and retry.';
  }
};

export function SmartScanProvider({ children }: { children: ReactNode }): ReactElement {
  const { showToast } = useToast();
  const [state, dispatch] = useReducer(smartScanReducer, initialState);
  const [debugSettings, setDebugSettingsState] = useState<DebugSettingsState>({
    engine: 'auto',
    showRawJson: false,
    showTimings: false,
    useMockAnalyze: false,
  });
  const [metrics, setMetrics] = useState<SmartScanMetrics>({});
  const [history, setHistory] = useState<SmartScanSession[]>([]);

  const decodeLoopRef = useRef<BarcodeDecodeLoop | null>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef: MutableRefObject<AbortController | null> = useRef<AbortController | null>(null);
  const dsldAbortRef = useRef<AbortController | null>(null);
  const dsldDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dsldLastQueryRef = useRef<string | null>(null);
  const dsldLastModeRef = useRef<'barcode' | 'text' | null>(null);

  const setDebugSettings = useCallback((updates: Partial<DebugSettingsState>) => {
    setDebugSettingsState((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateMetrics = useCallback((update: Partial<SmartScanMetrics> | ((prev: SmartScanMetrics) => SmartScanMetrics)) => {
    setMetrics((prev) => (typeof update === 'function' ? update(prev) : { ...prev, ...update }));
  }, []);

  const appendHistory = useCallback((entry: SmartScanSession) => {
    setHistory((prev) => [entry, ...prev].slice(0, 8));
  }, []);

  const cleanupAbortControllers = useCallback(() => {
    ocrAbortRef.current?.abort();
    analyzeAbortRef.current?.abort();
    searchAbortRef.current?.abort();
    dsldAbortRef.current?.abort();
    if (dsldDebounceRef.current) {
      clearTimeout(dsldDebounceRef.current);
    }
    ocrAbortRef.current = null;
    analyzeAbortRef.current = null;
    searchAbortRef.current = null;
    dsldAbortRef.current = null;
    dsldDebounceRef.current = null;
    dsldLastQueryRef.current = null;
    dsldLastModeRef.current = null;
  }, []);

  const resetDsldTracking = useCallback(() => {
    if (!DSLD_ENABLED) {
      return;
    }
    dsldAbortRef.current?.abort();
    dsldAbortRef.current = null;
    if (dsldDebounceRef.current) {
      clearTimeout(dsldDebounceRef.current);
      dsldDebounceRef.current = null;
    }
    dsldLastQueryRef.current = null;
    dsldLastModeRef.current = null;
  }, []);

  const logDsld = useCallback((message: string, details?: Record<string, unknown>) => {
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      if (details) {
        console.debug(message, details);
      } else {
        console.debug(message);
      }
    }
  }, []);


  useEffect(() => {
    if (!DSLD_ENABLED) {
      return;
    }

    const ocr = state.ocrResult && state.ocrResult.ok ? state.ocrResult : null;
    const barcode = state.barcodeResult && state.barcodeResult.ok ? state.barcodeResult : null;

    const shouldSkip =
      !ocr ||
      state.step === 'manual_correction' ||
      state.step === 'error' ||
      (!ocr.text && !ocr.productName && !ocr.brand);

    if (shouldSkip) {
      if (state.dsld.status !== 'idle' || state.dsld.data || state.dsld.error) {
        dispatch({ type: 'DSLD_RESET' });
      }
      resetDsldTracking();
      return;
    }

    const query = deriveDsldQuery(barcode, ocr);

    if (!query) {
      if (state.dsld.status !== 'idle' || state.dsld.data) {
        dispatch({ type: 'DSLD_RESET' });
      }
      resetDsldTracking();
      return;
    }

    if (
      dsldLastQueryRef.current === query.value &&
      dsldLastModeRef.current === query.mode &&
      state.dsld.status !== 'idle' &&
      state.dsld.status !== 'error'
    ) {
      return;
    }

    if (dsldDebounceRef.current) {
      clearTimeout(dsldDebounceRef.current);
    }

    dsldDebounceRef.current = setTimeout(() => {
      dsldDebounceRef.current = null;
      const controller = new AbortController();
      dsldAbortRef.current?.abort();
      dsldAbortRef.current = controller;
      dsldLastQueryRef.current = query.value;
      dsldLastModeRef.current = query.mode;

      dispatch({ type: 'DSLD_LOADING', query: query.value, mode: query.mode });
      logDsld('DSLD enrichment: search start', { query: query.value, mode: query.mode });

      const run = async () => {
        try {
          const searchPayload = await dsldSearch(query.value, { signal: controller.signal });
          const bestHit = pickBestDsldHit(searchPayload?.data, query);
          if (!bestHit || !bestHit._id) {
            logDsld('DSLD enrichment: no matching hit', { query: query.value });
            dispatch({ type: 'DSLD_SUCCESS', query: query.value, mode: query.mode, matchId: undefined, data: null });
            return;
          }

          logDsld('DSLD enrichment: match found', { id: bestHit._id, score: bestHit._score, query: query.value });
          const labelPayload = await dsldGetLabel(bestHit._id, { signal: controller.signal });
          const normalized = normalizeDsldLabel(labelPayload?.data);
          logDsld('DSLD enrichment: label normalized', {
            id: bestHit._id,
            ingredientCount: normalized.ingredientRows?.length ?? 0,
          });
          dispatch({
            type: 'DSLD_SUCCESS',
            query: query.value,
            mode: query.mode,
            matchId: bestHit._id,
            data: normalized,
          });
        } catch (error) {
          if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
            logDsld('DSLD enrichment: aborted', { query: query.value });
            return;
          }
          const message = error instanceof Error ? error.message : 'Unknown DSLD error';
          logDsld('DSLD enrichment: failed', { query: query.value, message });
          dispatch({ type: 'DSLD_ERROR', query: query.value, error: message });
        } finally {
          if (dsldAbortRef.current === controller) {
            dsldAbortRef.current = null;
          }
        }
      };

      void run();
    }, 400);

    return () => {
      if (dsldDebounceRef.current) {
        clearTimeout(dsldDebounceRef.current);
        dsldDebounceRef.current = null;
      }
    };
  }, [
    state.barcodeResult,
    state.dsld.data,
    state.dsld.error,
    state.dsld.status,
    state.ocrResult,
    state.step,
    dispatch,
    logDsld,
    resetDsldTracking,
  ]);

  const runAnalysisAndSearch = useCallback(
    async (
      barcode: BarcodeScanResult | null,
      ocr: OCRResult | null,
      textOverride?: string,
    ) => {
      const effectiveText = textOverride ?? ocr?.text ?? '';
      dispatch({ type: 'ANALYZE_START' });

      analyzeAbortRef.current?.abort();
      const analyzeController = new AbortController();
      analyzeAbortRef.current = analyzeController;

      const pendingSearchController = searchAbortRef.current;
      pendingSearchController?.abort();
      searchAbortRef.current = null;

      const input: AnalyzeInput = barcode?.code ? { barcode: barcode.code } : { text: effectiveText };
      let analysis: AnalysisResponse | null = null;
      const analyzeStartedAt = Date.now();
      const analyzeStartPerf = typeof performance !== 'undefined' ? performance.now() : analyzeStartedAt;
      let analysisUsedMock = false;

      updateMetrics((prev) => ({
        ...prev,
        analysis: {
          ...prev.analysis,
          status: 'running',
          startedAt: analyzeStartedAt,
          errorCode: undefined,
          source: debugSettings.useMockAnalyze ? 'mock' : 'live',
        },
      }));

      try {
        if (debugSettings.useMockAnalyze) {
          try {
            analysis = await apiClient.analyzeSupplement(input, {
              signal: analyzeController.signal,
              headers: { 'x-debug-mock': 'analysis' },
            });
          } catch (mockError) {
            console.info('Falling back to local mock analysis', mockError);
            analysis = null;
          }
          if (!analysis) {
            analysis = createMockAnalysis(effectiveText, barcode);
            analysisUsedMock = true;
          }
        } else {
          analysis = await apiClient.analyzeSupplement(input, { signal: analyzeController.signal });
        }
      } catch (error) {
        const message =
          error instanceof APIError
            ? error.friendlyMessage
            : error instanceof Error
              ? error.message
              : 'Analysis failed';
        const description =
          debugSettings.showRawJson && error instanceof APIError
            ? `${message} (${error.code})`
            : message;
        updateMetrics((prev) => ({
          ...prev,
          analysis: {
            ...prev.analysis,
            status: 'failed',
            errorCode: 'analyze_failed',
            completedAt: Date.now(),
          },
        }));
        dispatch({ type: 'ANALYZE_FAILURE', errorMessage: message });
        appendHistory({
          id: generateId(),
          timestamp: Date.now(),
          barcode,
          ocr,
          analysis: null,
          search: null,
          errorCode: 'analyze_failed',
          errorMessage: message,
        });
        showToast({ tone: 'error', title: 'Analysis failed', description });
        return;
      } finally {
        analyzeAbortRef.current = null;
      }

      if (!analysis) {
        return;
      }

      if (analysis.analysisMethod === 'mock_analysis') {
        analysisUsedMock = true;
      }

      const analyzeCompletedAt = Date.now();
      const analyzeDuration = typeof performance !== 'undefined'
        ? Math.round(performance.now() - analyzeStartPerf)
        : analyzeCompletedAt - analyzeStartedAt;

      updateMetrics((prev) => ({
        ...prev,
        analysis: {
          ...prev.analysis,
          status: 'complete',
          durationMs: analyzeDuration,
          errorCode: undefined,
          startedAt: analyzeStartedAt,
          completedAt: analyzeCompletedAt,
          source: analysisUsedMock ? 'mock' : 'live',
        },
      }));

      dispatch({ type: 'ANALYZE_SUCCESS', result: analysis });

      const previousSearchController = searchAbortRef.current as AbortController | null;
      previousSearchController?.abort();
      const searchController = new AbortController();
      searchAbortRef.current = searchController;

      let search: SearchResponse | null = null;
      let currentQuery = '';
      let sessionErrorCode: string | undefined;
      let sessionErrorMessage: string | undefined;

      try {
        currentQuery = buildSearchQuery(analysis, barcode, effectiveText);
        const searchStartedAt = Date.now();
        const searchStartPerf = typeof performance !== 'undefined' ? performance.now() : searchStartedAt;
        updateMetrics((prev) => ({
          ...prev,
          search: {
            ...prev.search,
            status: 'running',
            startedAt: searchStartedAt,
            errorCode: undefined,
            query: currentQuery,
          },
        }));
        search = await apiClient.searchSupplements({ query: currentQuery, limit: 6 }, { signal: searchController.signal });
        const searchCompletedAt = Date.now();
        const searchDuration = typeof performance !== 'undefined'
          ? Math.round(performance.now() - searchStartPerf)
          : searchCompletedAt - searchStartedAt;
        updateMetrics((prev) => ({
          ...prev,
          search: {
            ...prev.search,
            status: 'complete',
            durationMs: searchDuration,
            errorCode: undefined,
            startedAt: searchStartedAt,
            completedAt: searchCompletedAt,
            query: currentQuery,
          },
        }));
        dispatch({ type: 'SEARCH_SUCCESS', result: search });
      } catch (error) {
        sessionErrorCode = 'search_failed';
        sessionErrorMessage =
          error instanceof APIError
            ? error.friendlyMessage
            : error instanceof Error
              ? error.message
              : 'Search failed';
        const description =
          debugSettings.showRawJson && error instanceof APIError
            ? `${sessionErrorMessage} (${error.code})`
            : sessionErrorMessage;
        updateMetrics((prev) => ({
          ...prev,
          search: {
            ...prev.search,
            status: 'failed',
            errorCode: 'search_failed',
            completedAt: Date.now(),
            query: currentQuery,
          },
        }));
        dispatch({ type: 'SEARCH_FAILURE', errorMessage: sessionErrorMessage });
        showToast({ tone: 'error', title: 'Search failed', description });
      } finally {
        searchAbortRef.current = null;
        appendHistory({
          id: generateId(),
          timestamp: Date.now(),
          barcode,
          ocr,
          analysis,
          search,
          errorCode: sessionErrorCode,
          errorMessage: sessionErrorMessage,
        });
      }
    },
    [appendHistory, debugSettings.showRawJson, debugSettings.useMockAnalyze, showToast, updateMetrics],
  );

  const runOcrOnFile = useCallback(
    async (file: File, fallback?: BarcodeScanResult | null) => {
      if (fallback) {
        const normalizedFallback = normalizeBarcodeResult(fallback);
        dispatch({ type: 'BARCODE_FAILED', result: normalizedFallback });
        updateMetrics({
          barcode: {
            durationMs: normalizedFallback.durationMs,
            confidence: normalizedFallback.confidence,
            engine: normalizedFallback.engine,
            errorCode: normalizedFallback.errorCode,
            status: normalizedFallback.ok ? 'complete' : normalizedFallback.errorCode ?? 'barcode_failed',
          },
        });
        if (!normalizedFallback.ok) {
          const description = describeBarcodeError(normalizedFallback.errorCode);
          const details = debugSettings.showRawJson && normalizedFallback.errorMessage
            ? `${description} (${normalizedFallback.errorMessage})`
            : description;
          showToast({ tone: 'warning', title: 'Barcode not detected', description: details });
        }
      }

      ocrAbortRef.current?.abort();
      const controller = new AbortController();
      ocrAbortRef.current = controller;

      updateMetrics((prev) => ({
        ...prev,
        ocr: {
          ...prev.ocr,
          progress: 0,
          status: 'starting',
          errorCode: undefined,
        },
      }));

      try {
        const ocrResult = await ocrService.processImage(file, {
          signal: controller.signal,
          onProgress: (progress, status) => {
            updateMetrics((prev) => ({
              ...prev,
              ocr: {
                ...prev.ocr,
                progress,
                status,
              },
            }));
          },
        });
        const normalizedConfidence = (() => {
          if (typeof ocrResult.confidence === 'number' && Number.isFinite(ocrResult.confidence)) {
            return ocrResult.confidence;
          }
          if (!ocrResult.raw || typeof ocrResult.raw !== 'object') {
            return 0;
          }
          if (!('data' in (ocrResult.raw as Record<string, unknown>))) {
            return 0;
          }
          const confidenceValue = (ocrResult.raw as { data?: { confidence?: number } }).data?.confidence;
          if (typeof confidenceValue !== 'number') {
            return 0;
          }
          return confidenceValue > 1 ? confidenceValue / 100 : confidenceValue;
        })();
        updateMetrics((prev) => ({
          ...prev,
          ocr: {
            ...prev.ocr,
            durationMs: ocrResult.durationMs,
            confidence: normalizedConfidence,
            errorCode: undefined,
            progress: 100,
            status: ocrResult.ok ? 'complete' : ocrResult.errorCode ?? 'error',
          },
        }));

        if (ocrResult.ok && normalizedConfidence >= 0.8) {
          const successfulResult: OCRResult = {
            ...ocrResult,
            confidence: normalizedConfidence,
            errorCode: undefined,
          };
          dispatch({ type: 'OCR_SUCCEEDED', result: successfulResult });
          await runAnalysisAndSearch(fallback ?? state.barcodeResult, successfulResult, successfulResult.text);
        } else if (normalizedConfidence < 0.8) {
          const lowConfidenceResult: OCRResult = {
            ...ocrResult,
            ok: true,
            confidence: normalizedConfidence,
            errorCode: 'ocr_low_confidence',
            errorMessage: ocrResult.errorMessage ?? 'OCR confidence below threshold',
          };
          updateMetrics((prev) => ({
            ...prev,
            ocr: {
              ...prev.ocr,
              errorCode: 'ocr_low_confidence',
              status: 'manual_review',
            },
          }));
          dispatch({ type: 'OCR_LOW_CONFIDENCE', result: lowConfidenceResult });
          showToast({ tone: 'warning', title: 'Low OCR confidence', description: 'Please review the extracted text.' });
        } else {
          const failureResult: OCRResult = {
            ...ocrResult,
            ok: false,
            confidence: normalizedConfidence,
            errorCode: 'ocr_failed',
            errorMessage: ocrResult.errorMessage ?? 'OCR processing failed',
          };
          updateMetrics((prev) => ({
            ...prev,
            ocr: {
              ...prev.ocr,
              errorCode: 'ocr_failed',
              status: 'failed',
            },
          }));
          dispatch({ type: 'OCR_FAILED', result: failureResult });
          showToast({ tone: 'error', title: 'OCR failed', description: failureResult.errorMessage ?? 'Unknown error' });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          updateMetrics((prev) => ({
            ...prev,
            ocr: {
              ...prev.ocr,
              progress: 100,
              status: 'cancelled',
            },
          }));
          return;
        }
        const message = error instanceof Error ? error.message : 'OCR processing failed';
        updateMetrics((prev) => ({
          ...prev,
          ocr: {
            ...prev.ocr,
            progress: 100,
            status: 'failed',
            errorCode: 'ocr_failed',
          },
        }));
        const failureResult: OCRResult = {
          ok: false,
          text: '',
          confidence: 0,
          durationMs: 0,
          processingTime: 0,
          errorCode: 'ocr_failed',
          errorMessage: message,
        };
        dispatch({ type: 'OCR_FAILED', result: failureResult });
        showToast({ tone: 'error', title: 'OCR failed', description: message });
      } finally {
        ocrAbortRef.current = null;
      }
    },
    [debugSettings.showRawJson, runAnalysisAndSearch, showToast, state.barcodeResult, updateMetrics],
  );

  const runImageScan = useCallback(
    async (file: File) => {
      resetDsldTracking();
      const forceOCR = state.forceOCR;
      dispatch({ type: 'START_IMAGE', file });
      const service = new BarcodeService({ engine: debugSettings.engine });
      try {
        const result = await service.decodeFile(file);
        const normalizedResult = normalizeBarcodeResult(result);
        updateMetrics({
          barcode: {
            durationMs: normalizedResult.durationMs,
            confidence: normalizedResult.confidence,
            engine: normalizedResult.engine,
            errorCode: normalizedResult.errorCode,
            status: normalizedResult.ok ? 'complete' : normalizedResult.errorCode ?? 'barcode_failed',
          },
        });
        if (normalizedResult.ok && normalizedResult.code && !forceOCR) {
          dispatch({ type: 'BARCODE_SUCCEEDED', result: normalizedResult });
          await runAnalysisAndSearch(normalizedResult, state.ocrResult, state.ocrResult?.text);
        } else {
          await runOcrOnFile(file, normalizedResult);
        }
      } catch (error) {
        dispatch({
          type: 'ERROR',
          errorCode: 'barcode_failed',
          errorMessage: error instanceof Error ? error.message : 'Scan failed',
        });
        showToast({
          tone: 'error',
          title: 'Scan failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        await service.dispose();
      }
    },
    [
      debugSettings.engine,
      resetDsldTracking,
      runAnalysisAndSearch,
      runOcrOnFile,
      showToast,
      updateMetrics,
      state.forceOCR,
      state.ocrResult,
    ],
  );

  const stopCameraScan = useCallback(() => {
    decodeLoopRef.current?.stop();
    decodeLoopRef.current?.stopCamera();
    decodeLoopRef.current = null;
    cleanupAbortControllers();
  }, [cleanupAbortControllers]);

  const startCameraScan = useCallback(
    async ({
      video,
      canvas,
      overlay,
    }: {
      video: HTMLVideoElement;
      canvas: HTMLCanvasElement;
      overlay?: HTMLCanvasElement;
    }) => {
      stopCameraScan();
      resetDsldTracking();
      dispatch({ type: 'START_CAMERA' });

      const loop = new BarcodeDecodeLoop({
        video,
        canvas,
        overlay,
        engine: debugSettings.engine,
        timeoutMs: 10000,
        onResult: async (result) => {
          stopCameraScan();
          const normalizedResult = normalizeBarcodeResult(result);
          updateMetrics({
            barcode: {
              durationMs: normalizedResult.durationMs,
              confidence: normalizedResult.confidence,
              engine: normalizedResult.engine,
              errorCode: normalizedResult.errorCode,
              status: normalizedResult.ok ? 'complete' : normalizedResult.errorCode ?? 'barcode_failed',
            },
          });

          if (normalizedResult.ok && normalizedResult.code && !state.forceOCR) {
            dispatch({ type: 'BARCODE_SUCCEEDED', result: normalizedResult });
            await runAnalysisAndSearch(normalizedResult, state.ocrResult, state.ocrResult?.text);
            showToast({ tone: 'success', title: 'Barcode detected', description: normalizedResult.code });
            return;
          }

          try {
            const file = await canvasToFile(canvas, `frame-${Date.now()}.png`);
            await runOcrOnFile(file, normalizedResult);
          } catch (error) {
            dispatch({
              type: 'ERROR',
              errorCode: 'ocr_failed',
              errorMessage: error instanceof Error ? error.message : 'OCR fallback failed',
            });
            showToast({
              tone: 'error',
              title: 'OCR fallback failed',
              description: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        },
        onError: (error) => {
          dispatch({ type: 'ERROR', errorCode: 'barcode_failed', errorMessage: error.message });
          showToast({ tone: 'error', title: 'Barcode error', description: error.message });
        },
      });

      decodeLoopRef.current = loop;
      try {
        await loop.startCamera({ preferRearCamera: true, overlayCanvas: overlay });
        await loop.run();
      } catch (error) {
        stopCameraScan();
        dispatch({ type: 'ERROR', errorMessage: error instanceof Error ? error.message : 'Camera scan failed' });
        showToast({ tone: 'error', title: 'Camera scan failed', description: error instanceof Error ? error.message : 'Unknown error' });
      }
    },
    [
      debugSettings.engine,
      resetDsldTracking,
      runAnalysisAndSearch,
      runOcrOnFile,
      showToast,
      state.forceOCR,
      state.ocrResult,
      stopCameraScan,
      updateMetrics,
    ],
  );

  const confirmManualText = useCallback(
    async (text: string) => {
      if (!state.ocrResult && !state.file) return;
      const manualResult: OCRResult = {
        ...(state.ocrResult ?? {
          ok: true,
          text,
          confidence: 1,
          durationMs: 0,
        }),
        ok: true,
        text,
        confidence: 1,
        errorCode: undefined,
        errorMessage: undefined,
      };
      dispatch({ type: 'OCR_SUCCEEDED', result: manualResult });
      await runAnalysisAndSearch(state.barcodeResult, manualResult, text);
    },
    [runAnalysisAndSearch, state.barcodeResult, state.file, state.ocrResult],
  );

  const reset = useCallback(() => {
    stopCameraScan();
    cleanupAbortControllers();
    resetDsldTracking();
    dispatch({ type: 'RESET' });
  }, [cleanupAbortControllers, resetDsldTracking, stopCameraScan]);

  const setForceOCR = useCallback((value: boolean) => {
    dispatch({ type: 'SET_FORCE_OCR', value });
  }, []);

  const contextValue = useMemo<SmartScanContextValue>(() => ({
    state,
    debugSettings,
    setDebugSettings,
    metrics,
    history,
    runImageScan,
    startCameraScan,
    stopCameraScan,
    confirmManualText,
    reset,
    setForceOCR,
  }), [
    confirmManualText,
    debugSettings,
    history,
    metrics,
    reset,
    runImageScan,
    setForceOCR,
    startCameraScan,
    state,
    stopCameraScan,
    setDebugSettings,
  ]);

  return (
    <SmartScanContext.Provider value={contextValue}>
      {children}
    </SmartScanContext.Provider>
  );
}

export type { SmartScanState, SmartScanMetrics, SmartScanSession, DebugSettingsState, DsldNormalized };
export { smartScanReducer, SmartScanContext };
