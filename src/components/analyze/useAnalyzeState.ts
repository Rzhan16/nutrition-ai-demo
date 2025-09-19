'use client';

import { useReducer } from 'react';
import type {
  AnalyzeAction,
  AnalyzeStateShape,
  AnalyzeStatus,
  HistoryEntry,
  StepProgress,
} from '@/types/analyze';
import { analyzeInitialState } from '@/types/analyze';
import { generateId } from '@/lib/utils';

function computeStatusChange(current: AnalyzeStateShape, nextStatus: AnalyzeStatus): AnalyzeStateShape {
  return {
    ...current,
    status: nextStatus,
    error: nextStatus === 'error' ? current.error : null,
  };
}

function clampProgress(progress: StepProgress, key: keyof StepProgress, value: number): StepProgress {
  return {
    ...progress,
    [key]: Math.min(100, Math.max(0, Math.round(value))),
  } as StepProgress;
}

function reducer(state: AnalyzeStateShape, action: AnalyzeAction): AnalyzeStateShape {
  switch (action.type) {
    case 'UPLOAD_START': {
      return {
        ...state,
        status: 'uploading',
        error: null,
        upload: null,
        ocr: null,
        analysis: null,
        search: null,
        progress: { ...state.progress, upload: 5 },
        activeHistoryId: null,
      };
    }
    case 'UPLOAD_PROGRESS': {
      return {
        ...state,
        progress: clampProgress(state.progress, 'upload', action.value),
      };
    }
    case 'UPLOAD_SUCCESS': {
      return {
        ...state,
        status: 'ocr',
        upload: action.payload,
        progress: clampProgress(state.progress, 'upload', 100),
      };
    }
    case 'UPLOAD_FAILURE': {
      return {
        ...state,
        status: 'error',
        error: {
          step: 'uploading',
          message: action.message,
          detail: action.detail,
          retryAvailable: true,
        },
        progress: clampProgress(state.progress, 'upload', 0),
      };
    }
    case 'OCR_START': {
      return {
        ...state,
        status: 'ocr',
        error: null,
        ocr: null,
        progress: clampProgress(state.progress, 'ocr', 10),
      };
    }
    case 'OCR_PROGRESS': {
      return {
        ...state,
        progress: clampProgress(state.progress, 'ocr', action.value),
      };
    }
    case 'OCR_SUCCESS': {
      return {
        ...state,
        status: 'analyzing',
        ocr: action.payload,
        progress: clampProgress(state.progress, 'ocr', 100),
      };
    }
    case 'OCR_FAILURE': {
      return {
        ...state,
        status: 'error',
        error: {
          step: 'ocr',
          message: action.message,
          detail: action.detail,
          retryAvailable: true,
        },
        progress: clampProgress(state.progress, 'ocr', 0),
      };
    }
    case 'ANALYZE_START': {
      return {
        ...state,
        status: 'analyzing',
        error: null,
        progress: clampProgress(state.progress, 'analyze', 10),
      };
    }
    case 'ANALYZE_SUCCESS': {
      return {
        ...state,
        status: 'searching',
        analysis: action.payload,
        progress: clampProgress(state.progress, 'analyze', 100),
      };
    }
    case 'ANALYZE_FAILURE': {
      return {
        ...state,
        status: 'error',
        error: {
          step: 'analyzing',
          message: action.message,
          detail: action.detail,
          retryAvailable: true,
        },
        progress: clampProgress(state.progress, 'analyze', 0),
      };
    }
    case 'SEARCH_START': {
      return {
        ...state,
        status: 'searching',
        error: null,
        progress: clampProgress(state.progress, 'search', 15),
        search: null,
      };
    }
    case 'SEARCH_SUCCESS': {
      return {
        ...state,
        status: 'done',
        search: action.payload,
        progress: clampProgress(state.progress, 'search', 100),
      };
    }
    case 'SEARCH_FAILURE': {
      return {
        ...state,
        status: 'error',
        error: {
          step: 'searching',
          message: action.message,
          detail: action.detail,
          retryAvailable: true,
        },
        progress: clampProgress(state.progress, 'search', 0),
      };
    }
    case 'SET_STATUS': {
      return computeStatusChange(state, action.status);
    }
    case 'RESET_ERROR': {
      return {
        ...state,
        error: null,
        status: state.status === 'error' ? 'idle' : state.status,
      };
    }
    case 'SET_DEBUG': {
      return {
        ...state,
        debug: {
          ...state.debug,
          ...action.payload,
        },
      };
    }
    case 'SET_TIMING': {
      return {
        ...state,
        timings: {
          ...state.timings,
          [action.key]: action.value,
        },
      };
    }
    case 'ADD_HISTORY': {
      const alreadyExists = state.history.find((entry) => entry.id === action.payload.id);
      const nextHistory = alreadyExists
        ? state.history
        : [action.payload, ...state.history].slice(0, 8);

      return {
        ...state,
        history: nextHistory,
        activeHistoryId: action.payload.id,
      };
    }
    case 'RESTORE_HISTORY': {
      return {
        ...state,
        upload: action.payload.upload
          ? {
              file: new File([], action.payload.upload.response.filename),
              previewUrl: action.payload.upload.previewUrl,
              response: action.payload.upload.response,
              startedAt: action.payload.timestamp,
              completedAt: action.payload.timestamp,
            }
          : null,
        ocr: action.payload.ocr ?? null,
        analysis: action.payload.analysis ?? null,
        search: action.payload.search ?? null,
        status: action.payload.search ? 'done' : action.payload.analysis ? 'analyzing' : action.payload.ocr ? 'ocr' : 'idle',
        progress: {
          upload: action.payload.upload ? 100 : 0,
          ocr: action.payload.ocr ? 100 : 0,
          analyze: action.payload.analysis ? 100 : 0,
          search: action.payload.search ? 100 : 0,
        },
        error: null,
        activeHistoryId: action.payload.id,
      };
    }
    case 'SET_ACTIVE_HISTORY': {
      return {
        ...state,
        activeHistoryId: action.id,
      };
    }
    case 'CLEAR_UPLOAD': {
      return {
        ...state,
        upload: null,
        ocr: null,
        analysis: null,
        search: null,
        progress: {
          upload: 0,
          ocr: 0,
          analyze: 0,
          search: 0,
        },
        status: 'idle',
      };
    }
    case 'CLEAR_HISTORY': {
      return {
        ...state,
        history: [],
        activeHistoryId: null,
      };
    }
    case 'SET_CANCELLING': {
      return {
        ...state,
        isCancelling: action.value,
      };
    }
    default:
      return state;
  }
}

export function useAnalyzeState(): [AnalyzeStateShape, React.Dispatch<AnalyzeAction>] {
  return useReducer(reducer, analyzeInitialState);
}

export function buildHistoryEntry(state: AnalyzeStateShape, overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: overrides.id ?? generateId(),
    timestamp: Date.now(),
    upload: state.upload
      ? {
          previewUrl: state.upload.previewUrl,
          response: state.upload.response,
        }
      : undefined,
    ocr: state.ocr ?? undefined,
    analysis: state.analysis ?? undefined,
    search: state.search ?? undefined,
    ...overrides,
  };
}
