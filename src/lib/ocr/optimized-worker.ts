/**
 * Optimized OCR Worker Implementation
 * 
 * Features:
 * - Proper memory management with worker pools
 * - Enhanced error handling and recovery
 * - Progressive image enhancement
 * - Better timeout and cancellation handling
 * - Memory leak prevention
 * - Performance optimizations for mobile
 */

import Tesseract, { type RecognizeResult, type LoggerMessage, PSM, OEM } from 'tesseract.js';

export type TesseractLoggerMessage = LoggerMessage;
export type TesseractRecognizeResult = RecognizeResult;

type OcrImageSource = Blob | HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData;

export interface OcrImageMeta {
  width: number;
  height: number;
  pixelCount: number;
  aspectRatio: number;
  density: 'low' | 'medium' | 'high';
}

export interface OptimizedOcrOptions {
  maxSide?: number;
  threshold?: boolean;
  denoise?: boolean;
  autoRotate?: boolean;
  preserveColor?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface OcrPreprocessResult {
  canvas: HTMLCanvasElement;
  meta: OcrImageMeta & { 
    thresholdApplied: boolean;
    denoiseApplied: boolean;
    rotationApplied: number;
  };
}

// Configuration constants
const DEFAULT_MAX_SIDE = 1600;
const DEFAULT_TIMEOUT_MS = 25000;
const WORKER_IDLE_TIMEOUT = 30000; // 30 seconds

// Worker pool management
class WorkerPool {
  private workers: Map<string, {
    worker: Tesseract.Worker;
    lastUsed: number;
    busy: boolean;
  }> = new Map();
  
  private cleanupTimer: NodeJS.Timeout | null = null;

  async getWorker(language = 'eng'): Promise<Tesseract.Worker> {
    const key = `worker_${language}`;
    const existing = this.workers.get(key);
    
    if (existing && !existing.busy) {
      existing.lastUsed = Date.now();
      existing.busy = true;
      return existing.worker;
    }

    // Create new worker
    const worker = await this.createOptimizedWorker(language);
    this.workers.set(key, {
      worker,
      lastUsed: Date.now(),
      busy: true
    });

    this.scheduleCleanup();
    return worker;
  }

  releaseWorker(worker: Tesseract.Worker, language = 'eng'): void {
    const key = `worker_${language}`;
    const entry = this.workers.get(key);
    if (entry && entry.worker === worker) {
      entry.busy = false;
      entry.lastUsed = Date.now();
    }
  }

  private async createOptimizedWorker(language: string): Promise<Tesseract.Worker> {
    const corePath = await this.pickCorePath();
    
    const options: Partial<Tesseract.WorkerOptions> = {
      workerPath: '/tesseract/worker.min.js',
      corePath,
      langPath: '/tesseract',
      cacheMethod: 'write',
    };

    const worker = await Tesseract.createWorker(language, OEM.LSTM_ONLY, options);
    
    // Optimize for supplement labels
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: PSM.AUTO,
      tessedit_create_hocr: '0',
      tessedit_create_tsv: '0',
      tessedit_create_pdf: '0',
      // Enhanced for nutrition labels
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.%()-+µ/: \n',
    });

    return worker;
  }

  private async pickCorePath(): Promise<string> {
    const candidates = [
      '/tesseract/tesseract-core.wasm.js', 
      '/tesseract/tesseract-core.wasm'
    ];

    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate, { method: 'HEAD' });
        if (response.ok) {
          return candidate;
        }
      } catch (error) {
        console.warn('Failed to probe Tesseract core path', candidate, error);
      }
    }

    throw new Error('Unable to locate Tesseract core assets. Please run npm run stage:tess and retry.');
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
    }

    this.cleanupTimer = setTimeout(() => {
      this.cleanupIdleWorkers();
    }, WORKER_IDLE_TIMEOUT);
  }

  private async cleanupIdleWorkers(): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, entry] of this.workers.entries()) {
      if (!entry.busy && (now - entry.lastUsed) > WORKER_IDLE_TIMEOUT) {
        try {
          await entry.worker.terminate();
          toRemove.push(key);
        } catch (error) {
          console.warn('Failed to terminate idle worker:', error);
        }
      }
    }

    toRemove.forEach(key => this.workers.delete(key));
  }

  async terminateAll(): Promise<void> {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const promises = Array.from(this.workers.values()).map(entry => 
      entry.worker.terminate().catch(err => console.warn('Worker termination error:', err))
    );
    
    await Promise.all(promises);
    this.workers.clear();
  }
}

// Global worker pool instance
const workerPool = new WorkerPool();

// Enhanced image preprocessing
class ImageProcessor {
  static async preprocessImage(
    source: OcrImageSource, 
    options: OptimizedOcrOptions = {}
  ): Promise<OcrPreprocessResult> {
    const {
      maxSide = DEFAULT_MAX_SIDE,
      threshold = true,
      denoise = true,
      autoRotate = true,
      preserveColor = false
    } = options;

    let canvas = await this.sourceToCanvas(source);
    let rotationApplied = 0;

    // Resize if needed
    canvas = this.resizeCanvas(canvas, maxSide);
    
    // Calculate metadata
    const meta = this.calculateImageMeta(canvas);

    // Auto-rotation detection (for mobile photos)
    if (autoRotate && this.shouldAutoRotate(meta)) {
      const rotation = await this.detectOptimalRotation(canvas);
      if (Math.abs(rotation) > 5) {
        canvas = this.rotateCanvas(canvas, rotation);
        rotationApplied = rotation;
      }
    }

    let thresholdApplied = false;
    let denoiseApplied = false;

    // Apply preprocessing based on image characteristics
    if (!preserveColor) {
      this.convertToGrayscale(canvas);
    }

    if (denoise && this.shouldDenoise(meta)) {
      this.applyDenoising(canvas);
      denoiseApplied = true;
    }

    if (threshold && this.shouldApplyThreshold(meta)) {
      this.applyAdaptiveThreshold(canvas);
      thresholdApplied = true;
    }

    return {
      canvas,
      meta: {
        ...meta,
        thresholdApplied,
        denoiseApplied,
        rotationApplied
      }
    };
  }

  private static async sourceToCanvas(source: OcrImageSource): Promise<HTMLCanvasElement> {
    if (source instanceof HTMLCanvasElement) {
      return this.cloneCanvas(source);
    }

    if (source instanceof HTMLImageElement) {
      return this.imageToCanvas(source);
    }

    if (source instanceof ImageData) {
      return this.imageDataToCanvas(source);
    }

    if (source instanceof Blob) {
      const image = await this.blobToImage(source);
      return this.imageToCanvas(image);
    }

    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
      const canvas = this.createCanvas(source.width, source.height);
      const ctx = this.getContext(canvas);
      ctx.drawImage(source, 0, 0);
      source.close?.(); // Clean up ImageBitmap
      return canvas;
    }

    throw new Error('Unsupported image source type');
  }

  private static calculateImageMeta(canvas: HTMLCanvasElement): OcrImageMeta {
    const width = canvas.width;
    const height = canvas.height;
    const pixelCount = width * height;
    const aspectRatio = width / height;

    let density: 'low' | 'medium' | 'high';
    if (pixelCount < 300_000) density = 'low';
    else if (pixelCount < 1_000_000) density = 'medium';
    else density = 'high';

    return {
      width,
      height,
      pixelCount,
      aspectRatio,
      density
    };
  }

  private static shouldAutoRotate(meta: OcrImageMeta): boolean {
    // Auto-rotate for images that look like mobile photos
    return meta.aspectRatio > 0.5 && meta.aspectRatio < 2.0 && meta.pixelCount > 500_000;
  }

  private static shouldDenoise(meta: OcrImageMeta): boolean {
    // Denoise high-resolution images or images with poor quality indicators
    return meta.density === 'high' || meta.pixelCount > 1_500_000;
  }

  private static shouldApplyThreshold(meta: OcrImageMeta): boolean {
    // Apply threshold for most images except very small ones
    return meta.pixelCount > 100_000;
  }

  private static async detectOptimalRotation(canvas: HTMLCanvasElement): Promise<number> {
    // Simple rotation detection based on edge analysis
    // This could be enhanced with more sophisticated algorithms
    const angles = [0, 90, 180, 270];
    let bestAngle = 0;
    let bestScore = 0;

    for (const angle of angles) {
      const rotated = this.rotateCanvas(canvas, angle);
      const score = this.calculateTextScore(rotated);
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    }

    return bestAngle;
  }

  private static calculateTextScore(canvas: HTMLCanvasElement): number {
    const ctx = this.getContext(canvas);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Simple edge detection score - higher scores indicate better text orientation
    let edgeScore = 0;
    const data = imageData.data;
    
    for (let i = 0; i < data.length - 4; i += 4) {
      const current = data[i];
      const next = data[i + 4];
      edgeScore += Math.abs(current - next);
    }

    return edgeScore / (canvas.width * canvas.height);
  }

  private static resizeCanvas(canvas: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
    const { width, height } = canvas;
    const maxDimension = Math.max(width, height);
    
    if (maxDimension <= maxSide) {
      return this.cloneCanvas(canvas);
    }

    const scale = maxSide / maxDimension;
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    const resized = this.createCanvas(newWidth, newHeight);
    const ctx = this.getContext(resized);
    
    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, newWidth, newHeight);

    return resized;
  }

  private static convertToGrayscale(canvas: HTMLCanvasElement): void {
    const ctx = this.getContext(canvas);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      );
      data[i] = gray;     // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
      // Alpha channel (i + 3) remains unchanged
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private static applyDenoising(canvas: HTMLCanvasElement): void {
    const ctx = this.getContext(canvas);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Simple median filter for noise reduction
    const filtered = new Uint8ClampedArray(data.length);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Get neighborhood values
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            neighbors.push(data[nIdx]);
          }
        }
        
        neighbors.sort((a, b) => a - b);
        const median = neighbors[4]; // Middle value
        
        filtered[idx] = median;
        filtered[idx + 1] = median;
        filtered[idx + 2] = median;
        filtered[idx + 3] = data[idx + 3];
      }
    }

    // Copy filtered data back
    for (let i = 0; i < data.length; i++) {
      data[i] = filtered[i];
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private static applyAdaptiveThreshold(canvas: HTMLCanvasElement): void {
    const ctx = this.getContext(canvas);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Calculate adaptive threshold
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i];
      count++;
    }

    const average = sum / count;
    const threshold = average * 0.88; // Slightly more aggressive threshold

    for (let i = 0; i < data.length; i += 4) {
      const value = data[i] >= threshold ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private static rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
    if (degrees === 0) return canvas;

    const angle = (degrees * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));

    const newWidth = Math.round(canvas.width * cos + canvas.height * sin);
    const newHeight = Math.round(canvas.width * sin + canvas.height * cos);

    const rotated = this.createCanvas(newWidth, newHeight);
    const ctx = this.getContext(rotated);

    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(angle);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

    return rotated;
  }

  // Utility methods
  private static createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private static getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }
    return ctx;
  }

  private static cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const clone = this.createCanvas(source.width, source.height);
    this.getContext(clone).drawImage(source, 0, 0);
    return clone;
  }

  private static imageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
    const canvas = this.createCanvas(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height
    );
    this.getContext(canvas).drawImage(image, 0, 0);
    return canvas;
  }

  private static imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
    const canvas = this.createCanvas(imageData.width, imageData.height);
    this.getContext(canvas).putImageData(imageData, 0, 0);
    return canvas;
  }

  private static async blobToImage(blob: Blob): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = 'async';
      
      const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image from blob'));
      });
      
      image.src = url;
      
      // Try using decode() if available for better performance
      if (typeof image.decode === 'function') {
        try {
          await image.decode();
        } catch {
          // Fallback to load event
        }
      }
      
      return await loadPromise;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

// Enhanced PSM selection
function selectOptimalPSM(meta: OcrImageMeta & { thresholdApplied: boolean }): PSM {
  const { width, height, aspectRatio, density } = meta;

  // Single line detection for wide, short images
  if (aspectRatio >= 3.0 && height < 100) {
    return PSM.SINGLE_LINE;
  }

  // Single word for very small images
  if (width < 200 && height < 100) {
    return PSM.SINGLE_WORD;
  }

  // Sparse text for high-resolution images with likely scattered text
  if (density === 'high' && aspectRatio > 0.7 && aspectRatio < 1.5) {
    return PSM.SPARSE_TEXT;
  }

  // Single block for label-like images
  if (aspectRatio > 0.8 && aspectRatio < 1.25 && density !== 'low') {
    return PSM.SINGLE_BLOCK;
  }

  return PSM.AUTO;
}

// Main optimized worker interface
export class OptimizedOcrWorker {
  private processingCount = 0;
  private maxConcurrent = 2;

  async recognize(
    source: OcrImageSource,
    options: OptimizedOcrOptions = {},
    progressCallback?: (message: TesseractLoggerMessage) => void
  ): Promise<TesseractRecognizeResult> {
    
    if (this.processingCount >= this.maxConcurrent) {
      throw new Error('OCR worker at capacity. Please wait for current operations to complete.');
    }

    this.processingCount++;

    try {
      return await this.performRecognition(source, options, progressCallback);
    } finally {
      this.processingCount--;
    }
  }

  private async performRecognition(
    source: OcrImageSource,
    options: OptimizedOcrOptions,
    progressCallback?: (message: TesseractLoggerMessage) => void
  ): Promise<TesseractRecognizeResult> {
    
    const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
    const startTime = performance.now();

    // Check for abort signal
    if (signal?.aborted) {
      throw new DOMException('Operation was aborted', 'AbortError');
    }

    let worker: Tesseract.Worker | null = null;

    try {
      // Progressive callbacks
      progressCallback?.({ status: 'initializing', progress: 0 } as TesseractLoggerMessage);

      // Get worker from pool
      worker = await workerPool.getWorker();
      
      progressCallback?.({ status: 'preprocessing image', progress: 0.1 } as TesseractLoggerMessage);

      // Preprocess image
      const { canvas, meta } = await ImageProcessor.preprocessImage(source, options);
      
      progressCallback?.({ status: 'optimizing recognition settings', progress: 0.2 } as TesseractLoggerMessage);

      // Set optimal PSM
      const psm = selectOptimalPSM(meta);
      await worker.setParameters({ tessedit_pageseg_mode: psm });

      // Setup progress forwarding - use direct worker recognition
      const recognizeWithProgress = worker.recognize(canvas);

      // Add timeout and abort handling
      const result = await Promise.race([
        recognizeWithProgress,
        this.createTimeoutPromise(timeoutMs),
        this.createAbortPromise(signal)
      ]);

      const duration = performance.now() - startTime;
      console.debug('[optimized-ocr]', {
        duration: Math.round(duration),
        psm,
        meta,
        confidence: result.data?.confidence
      });

      return result;

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error(`OCR timeout after ${timeoutMs}ms`);
      }
      
      throw error;
    } finally {
      if (worker) {
        workerPool.releaseWorker(worker);
      }
    }
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('OCR timeout'));
      }, timeoutMs);
    });
  }

  private createAbortPromise(signal?: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
      if (!signal) return;
      
      if (signal.aborted) {
        reject(new DOMException('Operation was aborted', 'AbortError'));
        return;
      }
      
      signal.addEventListener('abort', () => {
        reject(new DOMException('Operation was aborted', 'AbortError'));
      }, { once: true });
    });
  }

  async terminate(): Promise<void> {
    await workerPool.terminateAll();
  }

  getStats() {
    return {
      processingCount: this.processingCount,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// Export singleton instance
export const optimizedOcrWorker = new OptimizedOcrWorker();

// Legacy compatibility
export async function getOptimizedOcrWorker(): Promise<OptimizedOcrWorker> {
  return optimizedOcrWorker;
}

export async function terminateOptimizedOcrWorker(): Promise<void> {
  await optimizedOcrWorker.terminate();
} 
