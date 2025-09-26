/**
 * Enhanced OCR Service Implementation
 * 
 * Features:
 * - Intelligent retry logic with progressive fallbacks
 * - Enhanced nutrition label parsing
 * - Confidence-based quality assessment
 * - Memory-efficient processing
 * - Comprehensive error recovery
 */

import type { 
  OCRResult, 
  OCRWord, 
  OCRBoundingBox, 
  ParsedIngredient, 
  NutritionFacts 
} from '@/lib/types';
import { 
  optimizedOcrWorker, 
  type OptimizedOcrOptions,
  type TesseractRecognizeResult 
} from './optimized-worker';
import { cleanOcrText } from './postprocess';

export interface EnhancedOcrOptions {
  /** Maximum timeout in milliseconds */
  timeoutMs?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Progress callback function */
  onProgress?: (progress: number, status: string) => void;
  /** Enable retry logic */
  enableRetry?: boolean;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Quality threshold for automatic acceptance */
  qualityThreshold?: number;
  /** Enable advanced preprocessing */
  advancedPreprocessing?: boolean;
}

export interface QualityMetrics {
  confidence: number;
  wordCount: number;
  avgWordConfidence: number;
  textLength: number;
  hasNutritionKeywords: boolean;
  hasNumericData: boolean;
  qualityScore: number;
}

const DEFAULT_OPTIONS: Required<EnhancedOcrOptions> = {
  timeoutMs: 7000, // Shorter default timeout
  signal: new AbortController().signal,
  onProgress: () => {},
  enableRetry: true,
  maxRetries: 1, // Reduce retries to speed up processing
  qualityThreshold: 0.6, // Lower quality threshold
  advancedPreprocessing: true
};

// Nutrition-specific patterns
const NUTRITION_PATTERNS = {
  SUPPLEMENT_FACTS: /supplement\s*facts/i,
  NUTRITION_FACTS: /nutrition\s*facts/i,
  INGREDIENTS: /ingredients?/i,
  SERVING_SIZE: /serving\s*size/i,
  DAILY_VALUE: /daily\s*value|%\s*dv|dv\s*%/i,
  VITAMIN_MINERAL: /vitamin|mineral|calcium|iron|zinc|magnesium/i,
  DOSAGE: /\b\d+\s*(mg|mcg|iu|g|ml)\b/i,
  PERCENTAGE: /\d+\s*%/,
  AMOUNT_PER_SERVING: /amount\s*per\s*serving/i
};

export class EnhancedOcrService {
  private processingHistory: Map<string, OCRResult> = new Map();
  private readonly maxHistorySize = 50;

  /**
   * Process an image file with enhanced OCR capabilities
   */
  async processImage(
    imageFile: File, 
    options: EnhancedOcrOptions = {}
  ): Promise<OCRResult> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const startTime = performance.now();
    
    // Generate cache key
    const cacheKey = await this.generateCacheKey(imageFile);
    
    // Check cache
    const cached = this.processingHistory.get(cacheKey);
    if (cached && this.isResultValid(cached)) {
      config.onProgress?.(100, 'Retrieved from cache');
      return cached;
    }

    try {
      config.onProgress?.(5, 'Initializing enhanced OCR');
      
      const result = await this.processWithRetry(imageFile, config);
      
      // Cache successful results
      if (result.ok) {
        this.cacheResult(cacheKey, result);
      }
      
      config.onProgress?.(100, 'Processing complete');
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        return this.createAbortedResult(duration);
      }
      
      if (error instanceof Error && error.message.includes('timeout')) {
        return this.createTimeoutResult(duration);
      }
      
      return this.createErrorResult(error, duration);
    }
  }

  private async processWithRetry(
    imageFile: File, 
    config: Required<EnhancedOcrOptions>
  ): Promise<OCRResult> {
    let lastError: Error | null = null;
    const maxAttempts = config.enableRetry ? config.maxRetries + 1 : 1;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const isRetry = attempt > 0;
        const progressOffset = (attempt / maxAttempts) * 100;
        
        if (isRetry) {
          config.onProgress?.(progressOffset, `Retry attempt ${attempt}/${config.maxRetries}`);
          // Wait briefly before retry
          await this.delay(1000 * attempt);
        }

        const ocrOptions = this.buildOcrOptions(config, attempt);
        const result = await this.performOcrRecognition(imageFile, ocrOptions, config, progressOffset);
        
        // Calculate quality from the OCR result
        const quality = this.calculateQualityFromOcrResult(result);
        
        // Check if we have ANY usable text
        const hasUsableText = result.text && result.text.trim().length > 2;
        const meetQualityThreshold = quality.qualityScore >= config.qualityThreshold;
        const isLastAttempt = attempt === maxAttempts - 1;
        
        if (meetQualityThreshold || isLastAttempt || hasUsableText) {
          console.log(`OCR attempt ${attempt + 1}: quality=${quality.qualityScore.toFixed(2)}, text="${result.text?.substring(0, 50)}..."`);
          return { ...result, qualityMetrics: quality };
        }
        
        // If quality is poor and we can retry, continue to next attempt
        console.warn(`OCR attempt ${attempt + 1} quality score: ${quality.qualityScore.toFixed(2)} (threshold: ${config.qualityThreshold})`);
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on abort or timeout
        if (error instanceof DOMException || 
            (error instanceof Error && error.message.includes('timeout'))) {
          throw error;
        }
        
        console.warn(`OCR attempt ${attempt + 1} failed:`, error);
      }
    }
    
    throw lastError || new Error('All OCR attempts failed');
  }

  private buildOcrOptions(config: Required<EnhancedOcrOptions>, attempt: number): OptimizedOcrOptions {
    const baseOptions: OptimizedOcrOptions = {
      timeoutMs: config.timeoutMs,
      signal: config.signal,
      maxSide: 1600,
      threshold: true,
      denoise: config.advancedPreprocessing,
      autoRotate: config.advancedPreprocessing,
      preserveColor: false
    };

    // Adjust options based on retry attempt
    if (attempt === 1) {
      // Second attempt: more aggressive preprocessing
      return {
        ...baseOptions,
        maxSide: 1800,
        denoise: true,
        threshold: true
      };
    } else if (attempt === 2) {
      // Third attempt: preserve more image quality
      return {
        ...baseOptions,
        maxSide: 2000,
        threshold: false,
        preserveColor: true
      };
    }

    return baseOptions;
  }

  private async performOcrRecognition(
    imageFile: File,
    ocrOptions: OptimizedOcrOptions,
    config: Required<EnhancedOcrOptions>,
    progressOffset: number
  ): Promise<OCRResult> {
    
    // Use the existing OCR service instead of the optimized worker to avoid postMessage issues
    const { ocrService } = await import('@/lib/ocr');
    
    const result = await ocrService.processImage(imageFile, {
      onProgress: (progress, status) => {
        const adjustedProgress = progressOffset + (progress * 0.8); // 80% of remaining progress
        config.onProgress?.(adjustedProgress, status);
      },
      signal: ocrOptions.signal,
      timeoutMs: Math.min(ocrOptions.timeoutMs || 7000, 7000) // Use shorter timeout
    });
    
    // The result is already an OCRResult, just return it
    return result;
  }

  private calculateQualityFromOcrResult(result: OCRResult): QualityMetrics {
    const text = result.text || '';
    const words = result.words || [];
    const confidence = result.confidence || 0;
    
    // Calculate word-level confidence
    const wordConfidences = words
      .map((w: any) => w.confidence || 0)
      .filter((c: number) => c > 0);
    const avgWordConfidence = wordConfidences.length > 0 
      ? wordConfidences.reduce((a: number, b: number) => a + b) / wordConfidences.length 
      : confidence;

    // Check for nutrition-specific content
    const hasNutritionKeywords = Object.values(NUTRITION_PATTERNS)
      .some(pattern => pattern.test(text));
    
    const hasNumericData = /\d/.test(text) && 
      (NUTRITION_PATTERNS.DOSAGE.test(text) || NUTRITION_PATTERNS.PERCENTAGE.test(text));

    // Calculate composite quality score
    let qualityScore = confidence * 0.4; // Base confidence weight
    qualityScore += avgWordConfidence * 0.3; // Word confidence weight
    qualityScore += (text.length > 50 ? 0.1 : 0); // Text length bonus
    qualityScore += (hasNutritionKeywords ? 0.15 : 0); // Nutrition content bonus
    qualityScore += (hasNumericData ? 0.05 : 0); // Numeric data bonus

    return {
      confidence,
      wordCount: words.length,
      avgWordConfidence,
      textLength: text.length,
      hasNutritionKeywords,
      hasNumericData,
      qualityScore: Math.min(1, qualityScore)
    };
  }

  private assessResultQuality(result: TesseractRecognizeResult): QualityMetrics {
    const text = result.data?.text || '';
    const words = (result.data as any)?.words || [];
    const confidence = (result.data?.confidence || 0) / 100;
    
    // Calculate word-level confidence
    const wordConfidences = words
      .map((w: any) => (w.confidence || 0) / 100)
      .filter((c: number) => c > 0);
    const avgWordConfidence = wordConfidences.length > 0 
      ? wordConfidences.reduce((a: number, b: number) => a + b) / wordConfidences.length 
      : 0;

    // Check for nutrition-specific content
    const hasNutritionKeywords = Object.values(NUTRITION_PATTERNS)
      .some(pattern => pattern.test(text));
    
    const hasNumericData = /\d/.test(text) && 
      (NUTRITION_PATTERNS.DOSAGE.test(text) || NUTRITION_PATTERNS.PERCENTAGE.test(text));

    // Calculate composite quality score
    let qualityScore = confidence * 0.4; // Base confidence weight
    qualityScore += avgWordConfidence * 0.3; // Word confidence weight
    qualityScore += (text.length > 50 ? 0.1 : 0); // Text length bonus
    qualityScore += (hasNutritionKeywords ? 0.15 : 0); // Nutrition content bonus
    qualityScore += (hasNumericData ? 0.05 : 0); // Numeric data bonus

    return {
      confidence,
      wordCount: words.length,
      avgWordConfidence,
      textLength: text.length,
      hasNutritionKeywords,
      hasNumericData,
      qualityScore: Math.min(1, qualityScore)
    };
  }

  private enhanceOcrResult(
    tesseractResult: TesseractRecognizeResult, 
    quality: QualityMetrics
  ): OCRResult {
    const rawText = tesseractResult.data?.text || '';
    const text = cleanOcrText(rawText);
    const words = this.extractWords(tesseractResult);
    const boundingBoxes = this.extractBoundingBoxes(tesseractResult);

    // Enhanced nutrition parsing
    const ingredients = this.extractIngredientsEnhanced(text);
    const nutritionFacts = this.parseNutritionFactsEnhanced(text);
    const servingSize = this.extractServingSize(text);
    const warnings = this.extractWarnings(text);
    const brandName = this.extractBrandName(text);
    const productName = this.extractProductName(text);

    const isHighQuality = quality.qualityScore >= 0.8;

    return {
      ok: isHighQuality,
      text,
      confidence: quality.confidence,
      durationMs: 0, // Will be set by caller
      processingTime: 0, // Will be set by caller
      words,
      bbox: boundingBoxes,
      ingredients,
      nutritionFacts,
      servingSize,
      warnings,
      brand: brandName,
      productName,
      qualityMetrics: quality,
      errorCode: isHighQuality ? undefined : 'ocr_low_confidence',
      errorMessage: isHighQuality ? undefined : 'OCR confidence below threshold',
      raw: tesseractResult
    };
  }

  private extractWords(result: TesseractRecognizeResult): OCRWord[] {
    const words = (result.data as any)?.words || [];
    return words.map((word: any) => ({
      text: word.text || '',
      confidence: (word.confidence || 0) / 100,
      bbox: word.bbox ? {
        x: word.bbox.x0 || 0,
        y: word.bbox.y0 || 0,
        width: (word.bbox.x1 || 0) - (word.bbox.x0 || 0),
        height: (word.bbox.y1 || 0) - (word.bbox.y0 || 0)
      } : undefined
    }));
  }

  private extractBoundingBoxes(result: TesseractRecognizeResult): OCRBoundingBox[] {
    const words = (result.data as any)?.words || [];
    return words.map((word: any) => ({
      x: word.bbox?.x0 || 0,
      y: word.bbox?.y0 || 0,
      width: (word.bbox?.x1 || 0) - (word.bbox?.x0 || 0),
      height: (word.bbox?.y1 || 0) - (word.bbox?.y0 || 0)
    }));
  }

  private extractIngredientsEnhanced(text: string): ParsedIngredient[] {
    const ingredients: ParsedIngredient[] = [];
    
    // Enhanced patterns for supplement labels
    const patterns = [
      // Standard format: Vitamin C (as Ascorbic Acid) 1000mg (1111% DV)
      /([A-Za-z\s\d\-()]+?)\s*([0-9,.]+)\s*(mg|mcg|g|iu|IU)\s*(?:\(([0-9,.]+)%?\s*(?:DV|Daily Value)\))?/gi,
      
      // Alternative format: Vitamin C: 1000mg
      /([A-Za-z\s\d\-()]+?):\s*([0-9,.]+)\s*(mg|mcg|g|iu|IU)/gi,
      
      // Per serving format
      /([A-Za-z\s\d\-()]+?)\s+per\s+serving\s*([0-9,.]+)\s*(mg|mcg|g|iu|IU)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [, name, amount, unit, dailyValue] = match;
        
        if (name && amount && unit) {
          ingredients.push({
            name: name.trim().replace(/[()]/g, ''),
            amount: amount.trim(),
            unit: unit.toLowerCase(),
            dailyValue: dailyValue?.trim()
          });
        }
      }
    }

    return this.deduplicateIngredients(ingredients);
  }

  private parseNutritionFactsEnhanced(text: string): NutritionFacts | undefined {
    const supplementFactsMatch = text.match(/supplement\s*facts/i);
    const nutritionFactsMatch = text.match(/nutrition\s*facts/i);
    
    if (!supplementFactsMatch && !nutritionFactsMatch) {
      return undefined;
    }

    const servingMatch = text.match(/serving\s*size[:\s]*([^\n]+)/i);
    const servingsPerContainerMatch = text.match(/servings?\s*per\s*container[:\s]*([^\n]+)/i);
    const caloriesMatch = text.match(/calories[:\s]*([^\n]+)/i);

    // Extract nutrients with enhanced parsing
    const nutrients = this.extractIngredientsEnhanced(text);

    return {
      servingSize: servingMatch?.[1]?.trim(),
      servingsPerContainer: servingsPerContainerMatch?.[1]?.trim(),
      calories: caloriesMatch?.[1]?.trim(),
      nutrients
    };
  }

  private extractServingSize(text: string): string | undefined {
    const patterns = [
      /serving\s*size[:\s]*([^\n]+)/i,
      /(\d+)\s*(capsule|tablet|softgel|gummies|scoop|pill)s?/i,
      /take\s*(\d+[^(\n]*)/i,
      /directions?[:\s]*.*?(\d+[^.\n]*)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractWarnings(text: string): string[] {
    const warnings: string[] = [];
    const warningKeywords = [
      'warning', 'warnings', 'caution', 'note', 'important',
      'keep out of reach', 'consult', 'not for use',
      'contains', 'allergen', 'may contain'
    ];

    const lines = text.split('\n');
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (warningKeywords.some(keyword => lowerLine.includes(keyword)) && 
          line.trim().length > 10) {
        warnings.push(line.trim());
      }
    }

    return warnings;
  }

  private extractBrandName(text: string): string | undefined {
    // Known supplement brands (expandable)
    const knownBrands = [
      'Pure Encapsulations', 'Thorne', 'Life Extension', 'NOW Foods',
      'Nature Made', 'Centrum', 'Garden of Life', 'Nordic Naturals',
      'New Chapter', 'Rainbow Light', 'Solgar', "Nature's Bounty",
      'Jarrow Formulas', "Doctor's Best", 'Source Naturals', 'Optimum Nutrition',
      'Dymatize', 'BSN', 'MuscleTech', 'Cellucor'
    ];

    const upperText = text.toUpperCase();
    for (const brand of knownBrands) {
      if (upperText.includes(brand.toUpperCase())) {
        return brand;
      }
    }

    // Fallback: look for brand-like text in first few lines
    const lines = text.split('\n').slice(0, 3);
    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned.length > 2 && cleaned.length < 30 && 
          /^[A-Za-z\s&'.®™]+$/.test(cleaned)) {
        return cleaned;
      }
    }

    return undefined;
  }

  private extractProductName(text: string): string | undefined {
    const lines = text.split('\n');
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      
      if (line.length < 5 || line.length > 60) continue;
      
      // Look for supplement-related keywords
      if (/vitamin|mineral|supplement|complex|formula|extract|acid|protein|omega|coq10|probiotics/i.test(line)) {
        return line;
      }
    }

    return undefined;
  }

  private deduplicateIngredients(ingredients: ParsedIngredient[]): ParsedIngredient[] {
    const seen = new Set<string>();
    return ingredients.filter(ingredient => {
      const key = ingredient.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Helper methods
  private async generateCacheKey(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b: number) => b.toString(16).padStart(2, '0')).join('');
  }

  private isResultValid(result: OCRResult): boolean {
    // Results are valid for 1 hour
    const oneHour = 60 * 60 * 1000;
    return Boolean(result.durationMs && (Date.now() - result.durationMs) < oneHour);
  }

  private cacheResult(key: string, result: OCRResult): void {
    this.processingHistory.set(key, result);
    
    // Maintain cache size
    if (this.processingHistory.size > this.maxHistorySize) {
      const firstKey = this.processingHistory.keys().next().value;
      if (firstKey) {
        this.processingHistory.delete(firstKey);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createAbortedResult(duration: number): OCRResult {
    return {
      ok: false,
      text: '',
      confidence: 0,
      durationMs: duration,
      processingTime: duration,
      wasAborted: true,
      errorCode: 'ocr_aborted',
      errorMessage: 'OCR processing was cancelled'
    };
  }

  private createTimeoutResult(duration: number): OCRResult {
    return {
      ok: false,
      text: '',
      confidence: 0,
      durationMs: duration,
      processingTime: duration,
      errorCode: 'ocr_timeout',
      errorMessage: 'OCR processing timed out'
    };
  }

  private createErrorResult(error: unknown, duration: number): OCRResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown OCR error';
    
    return {
      ok: false,
      text: '',
      confidence: 0,
      durationMs: duration,
      processingTime: duration,
      errorCode: 'ocr_failed',
      errorMessage
    };
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      cacheSize: this.processingHistory.size,
      maxCacheSize: this.maxHistorySize,
      workerStats: optimizedOcrWorker.getStats()
    };
  }

  /**
   * Clear processing cache
   */
  clearCache(): void {
    this.processingHistory.clear();
  }

  /**
   * Cleanup and terminate workers
   */
  async cleanup(): Promise<void> {
    this.clearCache();
    await optimizedOcrWorker.terminate();
  }
}

// Export singleton instance
export const enhancedOcrService = new EnhancedOcrService(); 