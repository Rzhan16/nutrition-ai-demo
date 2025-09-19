import type {
  AnalysisResponse,
  BarcodeEngineOption,
  OCRResult,
  SearchResponse,
  UploadResponse,
} from '@/lib/types';

export type AnalyzeStatus =
  | 'idle'
  | 'uploading'
  | 'ocr'
  | 'analyzing'
  | 'searching'
  | 'done'
  | 'error';

export interface UploadedFileInfo {
  file: File;
  previewUrl: string;
  response: UploadResponse;
  startedAt: number;
  completedAt: number;
}

export interface OcrState extends OCRResult {
  barcode?: string;
}

export interface AnalysisState extends AnalysisResponse {
  startedAt: number;
  completedAt: number;
  durationMs: number;
  source: 'mock' | 'live';
}

export interface SearchState extends SearchResponse {
  query: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

export interface AnalyzeError {
  step: AnalyzeStatus;
  message: string;
  detail?: string;
  retryAvailable: boolean;
}

export interface DebugSettings {
  useMockAnalyze: boolean;
  showRawJson: boolean;
  showTimings: boolean;
  barcodeEngine: BarcodeEngineOption;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  upload?: Pick<UploadedFileInfo, 'previewUrl' | 'response'>;
  ocr?: OcrState;
  analysis?: AnalysisState;
  search?: SearchState;
}

export interface StepProgress {
  upload: number;
  ocr: number;
  analyze: number;
  search: number;
}

export interface AnalyzeStateShape {
  status: AnalyzeStatus;
  upload: UploadedFileInfo | null;
  ocr: OcrState | null;
  analysis: AnalysisState | null;
  search: SearchState | null;
  history: HistoryEntry[];
  error: AnalyzeError | null;
  progress: StepProgress;
  activeHistoryId: string | null;
  debug: DebugSettings;
  timings: Record<string, number>;
  isCancelling: boolean;
}

export type AnalyzeAction =
  | { type: 'UPLOAD_START' }
  | { type: 'UPLOAD_PROGRESS'; value: number }
  | { type: 'UPLOAD_SUCCESS'; payload: UploadedFileInfo }
  | { type: 'UPLOAD_FAILURE'; message: string; detail?: string }
  | { type: 'OCR_START' }
  | { type: 'OCR_PROGRESS'; value: number }
  | { type: 'OCR_SUCCESS'; payload: OcrState }
  | { type: 'OCR_FAILURE'; message: string; detail?: string }
  | { type: 'ANALYZE_START' }
  | { type: 'ANALYZE_SUCCESS'; payload: AnalysisState }
  | { type: 'ANALYZE_FAILURE'; message: string; detail?: string }
  | { type: 'SEARCH_START'; query: string }
  | { type: 'SEARCH_SUCCESS'; payload: SearchState }
  | { type: 'SEARCH_FAILURE'; message: string; detail?: string }
  | { type: 'SET_STATUS'; status: AnalyzeStatus }
  | { type: 'RESET_ERROR' }
  | { type: 'SET_DEBUG'; payload: Partial<DebugSettings> }
  | { type: 'SET_TIMING'; key: string; value: number }
  | { type: 'ADD_HISTORY'; payload: HistoryEntry }
  | { type: 'RESTORE_HISTORY'; payload: HistoryEntry }
  | { type: 'SET_ACTIVE_HISTORY'; id: string | null }
  | { type: 'CLEAR_UPLOAD' }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_CANCELLING'; value: boolean };

export const analyzeInitialState: AnalyzeStateShape = {
  status: 'idle',
  upload: null,
  ocr: null,
  analysis: null,
  search: null,
  history: [],
  error: null,
  progress: {
    upload: 0,
    ocr: 0,
    analyze: 0,
    search: 0,
  },
  activeHistoryId: null,
  debug: {
    useMockAnalyze: (process.env.NEXT_PUBLIC_USE_MOCK_ANALYZE ?? 'false').toLowerCase() === 'true',
    showRawJson: false,
    showTimings: false,
    barcodeEngine: 'auto',
  },
  timings: {},
  isCancelling: false,
};
