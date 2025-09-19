import { mapApiErrorCode, retryWithBackoff } from '@/lib/utils';
import type {
  AnalysisResponse,
  APIResponse,
  ScanHistoryResponse,
  SearchResponse,
  UploadResponse,
} from '@/lib/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const DEFAULT_TIMEOUT = 15_000;

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public friendlyMessage: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
  description?: string;
}

function buildUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) {
    return endpoint;
  }
  return `${API_BASE_URL}${endpoint}`;
}

function prepareHeaders(options: RequestInit): HeadersInit {
  const headers = new Headers(options.headers ?? {});
  const body = options.body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return headers;
}

function parseResponseBody<T>(text: string): APIResponse<T> | null {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as APIResponse<T>;
  } catch (error) {
    console.warn('Failed to parse JSON response', error);
    return null;
  }
}

function toApiError(status: number, payload: APIResponse<unknown> | null, fallbackMessage: string): APIError {
  const code = payload?.error ?? `HTTP_${status}`;
  const message = payload?.message ?? fallbackMessage;
  return new APIError(status, code, message, mapApiErrorCode(code), payload?.data);
}

function toNetworkError(error: unknown): APIError {
  if (error instanceof APIError) {
    return error;
  }

  if (error instanceof DOMException) {
    if (error.name === 'AbortError') {
      return new APIError(0, 'ABORTED', 'Operation cancelled', 'The operation was cancelled.');
    }
    if (error.name === 'TimeoutError') {
      return new APIError(0, 'TIMEOUT', 'Request timed out', 'The request timed out; please try again.');
    }
  }

  const message = error instanceof Error ? error.message : 'Network request failed';
  return new APIError(0, 'NETWORK_ERROR', message, mapApiErrorCode('NETWORK_ERROR'));
}

async function makeRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    retries = 1,
    retryDelayMs = 250,
    signal,
    description,
    ...fetchOptions
  } = options;

  const requestFactory = async (): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new DOMException('Request timeout', 'TimeoutError'));
    }, timeoutMs);

    const abortListener = () => {
      controller.abort(new DOMException('Operation aborted', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('Operation aborted', 'AbortError');
      }
      signal.addEventListener('abort', abortListener, { once: true });
    }

    try {
      const response = await fetch(buildUrl(endpoint), {
        ...fetchOptions,
        headers: prepareHeaders(fetchOptions),
        signal: controller.signal,
      });

      const text = await response.text();
      const payload = parseResponseBody<T>(text);

      if (!response.ok || (payload && payload.success === false)) {
        throw toApiError(response.status, payload, response.statusText);
      }

      if (payload && payload.success !== undefined) {
        return (payload.data ?? ({} as T)) as T;
      }

      // If there is no structured payload, attempt to cast raw response
      return (payload ?? (text as unknown as T)) as T;
    } catch (error) {
      throw toNetworkError(error);
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', abortListener);
      }
    }
  };

  return retryWithBackoff<T>(requestFactory, {
    retries,
    initialDelayMs: retryDelayMs,
    signal,
    onRetry: (attempt, error) => {
      console.warn(`Retrying request${description ? ` for ${description}` : ''} (attempt ${attempt + 1})`, error);
    },
  });
}

export async function uploadImage(file: File, options: ApiRequestOptions = {}): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return makeRequest<UploadResponse>('/api/upload', {
    method: 'POST',
    body: formData,
    ...options,
  });
}

export type AnalyzeInput =
  | { imageUrl: string; userId?: string }
  | { text: string; userId?: string }
  | { barcode: string; userId?: string };

export async function analyzeSupplement(input: AnalyzeInput, options: ApiRequestOptions = {}): Promise<AnalysisResponse> {
  return makeRequest<AnalysisResponse>('/api/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
    ...options,
  });
}

export interface SearchParams {
  query: string;
  category?: string;
  brand?: string;
  page?: number;
  limit?: number;
}

export async function searchSupplements(params: SearchParams, options: ApiRequestOptions = {}): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('q', params.query);
  if (params.category) searchParams.set('category', params.category);
  if (params.brand) searchParams.set('brand', params.brand);
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());

  return makeRequest<SearchResponse>(`/api/search?${searchParams.toString()}`, options);
}

export async function advancedSearch(
  params: {
    query?: string;
    filters?: {
      category?: string[];
      brand?: string[];
      verified?: boolean;
    };
    sortBy?: 'name' | 'brand' | 'category' | 'created' | 'popularity' | 'relevance';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  },
  options: ApiRequestOptions = {},
): Promise<SearchResponse> {
  return makeRequest<SearchResponse>('/api/search', {
    method: 'POST',
    body: JSON.stringify(params),
    ...options,
  });
}

export async function getScanHistory(userId: string, options: { limit?: number; offset?: number } = {}): Promise<ScanHistoryResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('userId', userId);
  if (options.limit) searchParams.set('limit', options.limit.toString());
  if (options.offset) searchParams.set('offset', options.offset.toString());

  return makeRequest<ScanHistoryResponse>(`/api/analyze?${searchParams.toString()}`);
}

export async function getUploadInfo(): Promise<{
  limits: {
    maxFileSize: string;
    allowedTypes: string[];
    maxDimensions: string;
    processing: {
      compression: boolean;
      optimization: boolean;
      format: string;
    };
  };
  rateLimit: {
    remaining: number;
    resetTime: string;
  };
}> {
  return makeRequest('/api/upload');
}

export function isRateLimitError(error: unknown): boolean {
  return error instanceof APIError && error.code === 'RATE_LIMIT_EXCEEDED';
}

export const apiClient = {
  uploadImage,
  analyzeSupplement,
  searchSupplements,
  advancedSearch,
  getScanHistory,
  getUploadInfo,
};
