// @ts-nocheck

import type { Worker as TesseractWorker } from 'tesseract.js';
import {
  applyDynamicPageSegMode,
  getOcrWorker,
  preprocessOcrSource,
  type TesseractRecognizeResult,
} from '@/lib/ocr/worker';
import { cleanOcrText } from '@/lib/ocr/postprocess';
import type {
  NutritionFacts,
  OCRBoundingBox,
  OCRResult,
  OCRWord,
  ParsedIngredient,
} from '@/lib/types';

export interface ImageEnhancementOptions {
  autoRotate?: boolean;
  enhanceContrast?: boolean;
  reduceNoise?: boolean;
  detectTextRegions?: boolean;
}

const DEFAULT_LANG = 'eng';
const DEFAULT_TIMEOUT_MS = 7000;
const LOW_CONFIDENCE_THRESHOLD = 0.8;
const MAX_DIMENSION = 2048;

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

const loadImage = async (file: File): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to load image'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const createCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const downscaleImage = (image: HTMLImageElement): HTMLCanvasElement => {
  const maxDimension = Math.max(image.width, image.height);
  if (maxDimension <= MAX_DIMENSION) {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    ctx.drawImage(image, 0, 0);
    return canvas;
  }

  const scale = MAX_DIMENSION / maxDimension;
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
};

const toGrayscale = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
};

const adaptiveThreshold = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i];
  }
  const average = sum / (data.length / 4);
  const threshold = average * 0.9;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] >= threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
};

const rotateCanvas = (source: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement => {
  if (!angleDeg) return source;
  const angle = (angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(angle));
  const cos = Math.abs(Math.cos(angle));
  const width = source.width;
  const height = source.height;
  const newWidth = Math.floor(width * cos + height * sin);
  const newHeight = Math.floor(width * sin + height * cos);
  const canvas = createCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(angle);
  ctx.drawImage(source, -width / 2, -height / 2);
  return canvas;
};

const extractWords = (result: TesseractRecognizeResult): OCRWord[] => {
  const words = result.data?.words ?? [];
  return words.map((word) => ({
    text: word.text,
    confidence: (word.confidence ?? 0) / 100,
    bbox: word.bbox
      ? {
          x: word.bbox.x0 ?? 0,
          y: word.bbox.y0 ?? 0,
          width: (word.bbox.x1 ?? 0) - (word.bbox.x0 ?? 0),
          height: (word.bbox.y1 ?? 0) - (word.bbox.y0 ?? 0),
        }
      : undefined,
  }));
};

const extractBoundingBoxes = (result: TesseractRecognizeResult): OCRBoundingBox[] => {
  const words = result.data?.words ?? [];
  return words.map((word) => ({
    x: word.bbox?.x0 ?? 0,
    y: word.bbox?.y0 ?? 0,
    width: (word.bbox?.x1 ?? 0) - (word.bbox?.x0 ?? 0),
    height: (word.bbox?.y1 ?? 0) - (word.bbox?.y0 ?? 0),
  }));
};

const createTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('OCR timeout'));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

type NormalizedOcr = { text: string; confidence: number };

const normalizeOcrResult = (result: TesseractRecognizeResult): NormalizedOcr => {
  const data = result?.data;
  const rawConfidence = typeof data?.confidence === 'number' ? data.confidence : 0;
  const normalizedConfidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
  const confidence = Math.max(0, Math.min(1, normalizedConfidence));
  const text = cleanOcrText(data?.text ?? '');

  return {
    text,
    confidence,
  };
};

export class OCRService {
  private worker: TesseractWorker | null = null;
  private initializing: Promise<void> | null = null;

  private get language(): string {
    return (process.env.NEXT_PUBLIC_OCR_LANG || DEFAULT_LANG).trim() || DEFAULT_LANG;
  }

  private async ensureWorker(): Promise<TesseractWorker> {
    if (this.worker) return this.worker;

    if (!this.initializing) {
      this.initializing = getOcrWorker()
        .then((instance) => {
          this.worker = instance;
        })
        .finally(() => {
          this.initializing = null;
        });
    }

    await this.initializing;
    if (!this.worker) {
      throw new Error('Failed to initialize OCR worker');
    }
    return this.worker;
  }

  async processImage(
    imageFile: File,
    options: { onProgress?: (value: number, status: string) => void; signal?: AbortSignal; timeoutMs?: number } = {}
  ): Promise<OCRResult> {
    if (typeof window === 'undefined') {
      throw new Error('OCR is only available in the browser');
    }

    const start = performance.now();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (options.signal?.aborted) {
      return {
        ok: false,
        text: '',
        confidence: 0,
        durationMs: 0,
        wasAborted: true,
        errorCode: 'ocr_failed',
        errorMessage: 'OCR aborted prior to start',
      };
    }

    const abortHandler = () => {
      this.cancelCurrentJob().catch(() => undefined);
    };
    options.signal?.addEventListener('abort', abortHandler, { once: true });

    try {
      options.onProgress?.(5, 'initializing OCR worker');
      const worker = await this.ensureWorker();

      const image = await loadImage(imageFile);
      options.onProgress?.(10, 'preprocessing image');
      const baseCanvas = downscaleImage(image);

      const detectionCanvas = createCanvas(baseCanvas.width, baseCanvas.height);
      const detectionCtx = detectionCanvas.getContext('2d');
      detectionCtx?.drawImage(baseCanvas, 0, 0);

      let detectedAngle = 0;
      if (typeof worker.detect === 'function') {
        try {
          options.onProgress?.(35, 'detecting orientation');
          const detection = await createTimeout(worker.detect(detectionCanvas), timeoutMs);
          detectedAngle = detection?.data?.orientation?.degrees ?? 0;
        } catch (detectError) {
          console.warn('OCR orientation detection failed, using raw image', detectError);
        }
      }

      let canvas = baseCanvas;
      if (detectedAngle && Math.abs(detectedAngle) > 1) {
        canvas = rotateCanvas(baseCanvas, -detectedAngle);
      }

      options.onProgress?.(45, 'enhancing image for OCR');
      const { canvas: preparedCanvas, meta: preprocessMeta } = await preprocessOcrSource(canvas, {
        threshold: true,
        maxSide: 1500,
      });
      const psm = await applyDynamicPageSegMode(worker, preprocessMeta);

      console.debug('[ocr]', {
        psm,
        width: preprocessMeta.width,
        height: preprocessMeta.height,
        thresholdOn: preprocessMeta.thresholdOn,
      });

      options.onProgress?.(70, 'recognizing text');
      const recognizePromise = worker.recognize(preparedCanvas);
      const result = await createTimeout(recognizePromise, timeoutMs);

      const durationMs = performance.now() - start;
      const normalized = normalizeOcrResult(result);
      const words = extractWords(result);
      const wordsConfidence = words.length ? median(words.map((word) => word.confidence)) : undefined;
      const combinedConfidence = typeof wordsConfidence === 'number' ? wordsConfidence : normalized.confidence;
      const confidence = Math.max(0, Math.min(1, combinedConfidence));

      const text = normalized.text;
      const ingredients = await this.extractIngredients(text);
      const servingSize = this.extractServingSize(text);
      const brand = this.extractBrandName(text);
      const productName = this.extractProductName(text);
      const nutritionFacts = this.parseNutritionFacts(text);
      const warnings = this.extractWarnings(text);
      const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;

      options.onProgress?.(95, 'finalizing results');

      options.onProgress?.(100, 'complete');

      return {
        ok: !lowConfidence,
        text,
        confidence,
        durationMs,
        processingTime: durationMs,
        words,
        bbox: extractBoundingBoxes(result),
        errorCode: lowConfidence ? 'ocr_low_confidence' : undefined,
        errorMessage: lowConfidence ? 'OCR confidence below threshold' : undefined,
        ingredients,
        servingSize,
        brand,
        productName,
        nutritionFacts,
        warnings,
        raw: result,
      };
    } catch (error) {
      const durationMs = performance.now() - start;
      const progressStatus = options.signal?.aborted ? 'cancelled' : 'failed';
      options.onProgress?.(100, progressStatus);
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          ok: false,
          text: '',
          confidence: 0,
          durationMs,
          wasAborted: true,
          errorCode: 'ocr_failed',
          errorMessage: 'OCR aborted',
          processingTime: durationMs,
        };
      }

      if (error instanceof Error && error.message === 'OCR timeout') {
        return {
          ok: false,
          text: '',
          confidence: 0,
          durationMs,
          errorCode: 'ocr_timeout',
          errorMessage: 'OCR timed out',
          processingTime: durationMs,
        };
      }

      console.error('OCR processing failed:', error);
      return {
        ok: false,
        text: '',
        confidence: 0,
        durationMs,
        errorCode: 'ocr_failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown OCR error',
        processingTime: durationMs,
      };
    } finally {
      options.signal?.removeEventListener('abort', abortHandler);
    }
  }

  async extractIngredients(text: string): Promise<ParsedIngredient[]> {
    const ingredients: ParsedIngredient[] = [];
    const ingredientsSection = this.extractSection(text, [
      'ingredients',
      'ingredient list',
      'contains',
      'active ingredients',
      'supplement facts',
    ]);

    if (!ingredientsSection) return ingredients;

    const patterns = [
      /([A-Za-z\s\d\-]+)\s*\(([^)]+)\)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*\((\d+%)\s*DV\)/gi,
      /([A-Za-z\s\d\-]+)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|IU)/gi,
      /([A-Za-z\s\d\-]+):\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|IU)\s*\((\d+%)\s*(?:Daily\s*Value|DV)\)/gi,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(ingredientsSection)) !== null) {
        const [, name, amount, unit, dailyValue] = match;
        ingredients.push({
          name: name.trim(),
          amount: amount?.trim(),
          unit: unit?.toLowerCase(),
          dailyValue: dailyValue?.trim(),
        });
      }
    });

    return this.removeDuplicateIngredients(ingredients);
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  async cancelCurrentJob(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  private extractSection(text: string, keywords: string[]): string | null {
    const lowerText = text.toLowerCase();

    for (const keyword of keywords) {
      const index = lowerText.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        const section = text.substring(index);
        const endIndex = section.search(/\n\s*\n|\n[A-Z][A-Z]/);
        return endIndex > 0 ? section.substring(0, endIndex) : section;
      }
    }

    return null;
  }

  private extractServingSize(text: string): string | undefined {
    const patterns = [
      /serving size[:\s]+([^\n]+)/i,
      /servings? per container[:\s]+([^\n]+)/i,
      /(\d+)\s*(capsule|tablet|softgel|gummies|scoop)/i,
      /take\s*(\d+[^(\n]*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractBrandName(text: string): string | undefined {
    const knownBrands = [
      'Pure Encapsulations',
      'Thorne',
      'Life Extension',
      'NOW Foods',
      'Nature Made',
      'Centrum',
      'Garden of Life',
      'Nordic Naturals',
      'New Chapter',
      'Rainbow Light',
      'Solgar',
      "Nature's Bounty",
      'Jarrow Formulas',
      "Doctor's Best",
      'Source Naturals',
    ];

    const upperText = text.toUpperCase();
    for (const brand of knownBrands) {
      if (upperText.includes(brand.toUpperCase())) {
        return brand;
      }
    }

    const lines = text.split('\n').slice(0, 3);
    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned.length > 2 && cleaned.length < 30 && /^[A-Za-z\s&'.]+$/.test(cleaned)) {
        return cleaned;
      }
    }

    return undefined;
  }

  private extractProductName(text: string): string | undefined {
    const lines = text.split('\n');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length < 3 || line.length > 50) continue;
      if (/vitamin|mineral|supplement|complex|formula|extract|acid|protein/i.test(line)) {
        return line;
      }
    }
    return undefined;
  }

  private parseNutritionFacts(text: string): NutritionFacts | undefined {
    const section = this.extractSection(text, ['supplement facts', 'nutrition facts']);
    if (!section) return undefined;

    const servingMatch = section.match(/serving size[:\s]+([^\n]+)/i);
    const servingsPerContainerMatch = section.match(/servings? per container[:\s]+([^\n]+)/i);
    const caloriesMatch = section.match(/calories[:\s]+([^\n]+)/i);

    const nutrients: ParsedIngredient[] = [];
    const lines = section.split('\n');
    const nutrientPattern = /([A-Za-z\s\d\-]+)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|IU)\s*(?:\((\d+%)\s*(?:Daily\s*Value|DV)\))?/i;
    lines.forEach((line) => {
      const match = line.match(nutrientPattern);
      if (match) {
        const [, name, amount, unit, dailyValue] = match;
        nutrients.push({
          name: name.trim(),
          amount: amount.trim(),
          unit: unit?.toLowerCase(),
          dailyValue: dailyValue?.trim(),
        });
      }
    });

    return {
      servingSize: servingMatch?.[1]?.trim(),
      servingsPerContainer: servingsPerContainerMatch?.[1]?.trim(),
      calories: caloriesMatch?.[1]?.trim(),
      nutrients,
    };
  }

  private extractWarnings(text: string): string[] {
    const warnings: string[] = [];
    const warningSection = this.extractSection(text, [
      'warning',
      'warnings',
      'caution',
      'contains',
      'allergens',
      'keep out of reach',
      'consult your physician',
    ]);

    if (warningSection) {
      warningSection
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 10)
        .forEach((line) => warnings.push(line));
    }

    return warnings;
  }

  private removeDuplicateIngredients(ingredients: ParsedIngredient[]): ParsedIngredient[] {
    const seen = new Set<string>();
    return ingredients.filter((ingredient) => {
      const key = ingredient.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const ocrService = new OCRService();
