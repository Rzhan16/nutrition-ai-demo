import { ocrService } from '@/lib/ocr';
import type { OCRResult } from '@/lib/types';

export interface EnhancedOcrOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number, status: string) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  qualityThreshold?: number;
}

const DEFAULT_OPTIONS: Required<Omit<EnhancedOcrOptions, 'signal' | 'onProgress'>> = {
  timeoutMs: 10_000,
  enableRetry: true,
  maxRetries: 1,
  qualityThreshold: 0.7,
};

export class EnhancedOcrService {
  async processImage(
    imageFile: File,
    options: EnhancedOcrOptions = {}
  ): Promise<OCRResult> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const attemptCount = config.enableRetry ? Math.max(1, config.maxRetries) : 1;
    let lastResult: OCRResult | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < attemptCount; attempt++) {
      const attemptLabel = attempt + 1;
      try {
        const result = await ocrService.processImage(imageFile, {
          signal: config.signal,
          timeoutMs: config.timeoutMs,
          onProgress: (value, status) => {
            const base = (attempt / attemptCount) * 100;
            const scaled = base + value / attemptCount;
            options.onProgress?.(
              Math.min(100, Math.round(scaled)),
              `${status} (attempt ${attemptLabel}/${attemptCount})`
            );
          },
        });

        lastResult = result;
        const quality = result.qualityMetrics?.qualityScore ?? result.confidence;
        if (!config.enableRetry || quality >= config.qualityThreshold || result.ok) {
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (!config.enableRetry || attempt === attemptCount - 1) {
          throw lastError;
        }
      }
    }

    if (lastResult) {
      return lastResult;
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error('Enhanced OCR failed without producing a result');
  }
}

export const enhancedOcrService = new EnhancedOcrService();
