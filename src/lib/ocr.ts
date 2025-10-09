import { callPaddleOCR, type PaddleOCRResponse } from '@/lib/ocr/paddle-client';
import type {
  NutritionFacts,
  OCRBoundingBox,
  OCRDiagnostics,
  OCRResult,
  OCRWord,
  ParsedIngredient,
} from '@/lib/types';

interface ProcessOptions {
  onProgress?: (value: number, status: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8;
const DEFAULT_TIMEOUT_MS = 10_000;

function getConfidenceThreshold(): number {
  const value =
    process.env.NEXT_PUBLIC_OCR_CONFIDENCE_MIN ??
    process.env.OCR_CONFIDENCE_MIN ??
    '';

  const parsed = Number.parseFloat(value);
  if (Number.isFinite(parsed)) {
    return Math.min(0.99, Math.max(0.1, parsed));
  }
  return DEFAULT_CONFIDENCE_THRESHOLD;
}

function getTimeoutMs(custom?: number): number {
  if (typeof custom === 'number' && Number.isFinite(custom) && custom > 0) {
    return custom;
  }
  const value =
    process.env.NEXT_PUBLIC_OCR_TIMEOUT_MS ??
    process.env.OCR_TIMEOUT_MS ??
    '';
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_TIMEOUT_MS;
}

function mapWords(words: PaddleOCRResponse['words'] = []): OCRWord[] {
  return words.map(word => {
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = word.bbox ?? [];
    const bbox: OCRBoundingBox = {
      x: x0,
      y: y0,
      width: Math.max(0, x1 - x0),
      height: Math.max(0, y1 - y0),
    };
    return {
      text: word.text ?? '',
      confidence: typeof word.confidence === 'number' ? word.confidence : 0,
      bbox,
    } satisfies OCRWord;
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calculateQualityMetrics(
  text: string,
  words: OCRWord[],
  confidence: number,
  threshold: number
): NonNullable<OCRResult['qualityMetrics']> {
  const confidences = words.map(word => word.confidence).filter(Boolean);
  const avgWordConfidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : confidence;

  const nutritionKeywords = [
    'supplement facts',
    'nutrition facts',
    'ingredients',
    'serving size',
    'daily value',
    'calories',
    'vitamin',
    'mineral',
  ];

  const lower = text.toLowerCase();
  const hasNutritionKeywords = nutritionKeywords.some(keyword =>
    lower.includes(keyword)
  );
  const hasNumericData = /\b\d+(?:\.\d+)?\s*(mg|mcg|g|iu|%)\b/i.test(text);
  const qualityScore = Math.min(
    1,
    (confidence * 0.5 + avgWordConfidence * 0.35 +
      (hasNutritionKeywords ? 0.1 : 0) +
      (hasNumericData ? 0.05 : 0))
  );

  return {
    confidence,
    wordCount: words.length,
    avgWordConfidence,
    medianWordConfidence: confidences.length ? median(confidences) : confidence,
    textLength: text.length,
    hasNutritionKeywords,
    hasNumericData,
    qualityScore,
    lowConfidenceThreshold: threshold,
    belowThreshold: confidence < threshold,
  };
}

function buildDiagnostics(
  confidence: number,
  metrics: NonNullable<OCRResult['qualityMetrics']>,
  durationMs: number,
  response: PaddleOCRResponse
): OCRDiagnostics {
  return {
    confidence,
    normalizedConfidence: confidence,
    medianWordConfidence: metrics.medianWordConfidence ?? confidence,
    lowConfidenceThreshold: metrics.lowConfidenceThreshold,
    belowThreshold: metrics.belowThreshold,
    wordCount: metrics.wordCount,
    detectedOrientationDegrees: response.orientation?.angle ?? 0,
    orientationConfidence: response.orientation?.confidence,
    appliedRotationDegrees: 0,
    durationMs,
    timestamp: new Date().toISOString(),
    preprocess: {
      width: 0,
      height: 0,
      thresholdOn: false,
      averageBrightness: 0,
      stdDeviation: 0,
      sourceAverageBrightness: 0,
      sourceStdDeviation: 0,
      denoiseApplied: false,
      autoThreshold: false,
    },
  };
}

export class OCRService {
  async processImage(file: File, options: ProcessOptions = {}): Promise<OCRResult> {
    if (typeof window === 'undefined') {
      throw new Error('OCR is only available in the browser environment');
    }

    const threshold = getConfidenceThreshold();
    const timeoutMs = getTimeoutMs(options.timeoutMs);
    const start = performance.now();

    options.onProgress?.(5, 'Uploading image to OCR service');

    try {
      const result = await callPaddleOCR(file, options.signal, timeoutMs);

      options.onProgress?.(60, 'Parsing OCR response');

      const text = (result.text ?? '').trim();
      const words = mapWords(result.words);
      const confidences = words.map(word => word.confidence).filter(Boolean);
      const confidence = confidences.length
        ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
        : text.length > 0
        ? 0.5
        : 0;

      const durationMs = performance.now() - start;

      const qualityMetrics = calculateQualityMetrics(
        text,
        words,
        confidence,
        threshold
      );

      const diagnostics = buildDiagnostics(
        confidence,
        qualityMetrics,
        durationMs,
        result
      );

      options.onProgress?.(75, 'Extracting nutrition insights');

      const ingredients = await this.extractIngredients(text);
      const servingSize = this.extractServingSize(text);
      const brand = this.extractBrandName(text);
      const productName = this.extractProductName(text);
      const nutritionFacts = this.parseNutritionFacts(text);
      const warnings = this.extractWarnings(text);

      const lowConfidence = confidence < threshold;
      const boundingBoxes: OCRBoundingBox[] = words
        .map(word => word.bbox)
        .filter((bbox): bbox is OCRBoundingBox => Boolean(bbox));

      options.onProgress?.(100, 'OCR complete');

      return {
        ok: !lowConfidence,
        text,
        confidence,
        durationMs,
        processingTime: durationMs,
        words,
        bbox: boundingBoxes,
        errorCode: lowConfidence ? 'ocr_low_confidence' : undefined,
        errorMessage: lowConfidence
          ? 'OCR confidence below configured threshold'
          : undefined,
        ingredients,
        servingSize,
        brand,
        productName,
        nutritionFacts,
        warnings,
        qualityMetrics,
        diagnostics,
        raw: result,
      };
    } catch (error) {
      const durationMs = performance.now() - start;

      if (options.signal?.aborted) {
        return {
          ok: false,
          text: '',
          confidence: 0,
          durationMs,
          processingTime: durationMs,
          wasAborted: true,
          errorCode: 'ocr_aborted',
          errorMessage: 'OCR request aborted',
        };
      }

      if ((error as Error).message === 'ocr-timeout') {
        return {
          ok: false,
          text: '',
          confidence: 0,
          durationMs,
          processingTime: durationMs,
          errorCode: 'ocr_timeout',
          errorMessage: `OCR request exceeded ${timeoutMs}ms timeout`,
        };
      }

      return {
        ok: false,
        text: '',
        confidence: 0,
        durationMs,
        processingTime: durationMs,
        errorCode: 'ocr_failed',
        errorMessage:
          error instanceof Error ? error.message : 'Unknown OCR failure',
      };
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

    patterns.forEach(pattern => {
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
      if (
        cleaned.length > 2 &&
        cleaned.length < 30 &&
        /^[A-Za-z\s&'.]+$/.test(cleaned)
      ) {
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
      if (
        /vitamin|mineral|supplement|complex|formula|extract|acid|protein/i.test(
          line
        )
      ) {
        return line;
      }
    }

    return undefined;
  }

  private parseNutritionFacts(text: string): NutritionFacts | undefined {
    const section = this.extractSection(text, [
      'supplement facts',
      'nutrition facts',
    ]);
    if (!section) return undefined;

    const servingMatch = section.match(/serving size[:\s]+([^\n]+)/i);
    const servingsPerContainerMatch = section.match(
      /servings? per container[:\s]+([^\n]+)/i
    );
    const caloriesMatch = section.match(/calories[:\s]+([^\n]+)/i);

    const nutrients: ParsedIngredient[] = [];
    const lines = section.split('\n');
    const nutrientPattern =
      /([A-Za-z\s\d\-]+)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|IU)\s*(?:\((\d+%)\s*(?:Daily\s*Value|DV)\))?/i;
    lines.forEach(line => {
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
        .map(line => line.trim())
        .filter(line => line.length > 10)
        .forEach(line => warnings.push(line));
    }

    return warnings;
  }

  private removeDuplicateIngredients(
    ingredients: ParsedIngredient[]
  ): ParsedIngredient[] {
    const seen = new Set<string>();
    return ingredients.filter(ingredient => {
      const key = ingredient.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const ocrService = new OCRService();
