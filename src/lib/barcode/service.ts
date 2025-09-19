import type { BarcodeScanResult, BarcodeEngineOption, BarcodeEngine, BarcodeFormat } from '@/lib/types';
import { getBarcodeConfig } from './config';
import type { BarcodeEngineAdapter, BarcodeDecodeOptions } from './types';
import { QuaggaAdapter } from './adapters/quagga';
import { ZXingAdapter } from './adapters/zxing';
import { Html5QrcodeAdapter } from './adapters/html5-qrcode';
import { buildErrorResult, nowMs, isBrowser } from './utils';

const ENGINE_PRIORITY: BarcodeEngine[] = ['quagga', 'zxing', 'html5-qrcode'];

export const resolveEngines = (option: BarcodeEngineOption): BarcodeEngine[] => {
  if (option === 'auto') {
    return ENGINE_PRIORITY;
  }
  return [option as BarcodeEngine].filter((engine): engine is BarcodeEngine => ENGINE_PRIORITY.includes(engine));
};

const createAdapter = (engine: BarcodeEngine): BarcodeEngineAdapter => {
  switch (engine) {
    case 'quagga':
      return new QuaggaAdapter();
    case 'zxing':
      return new ZXingAdapter();
    case 'html5-qrcode':
      return new Html5QrcodeAdapter();
    default:
      throw new Error(`Unsupported barcode engine: ${engine}`);
  }
};

export interface BarcodeServiceOptions {
  engine?: BarcodeEngineOption;
  allowedFormats?: BarcodeFormat[];
  framesPerSecond?: number;
  consensusThreshold?: number;
  timeoutMs?: number;
}

export class BarcodeService {
  private readonly adapters = new Map<BarcodeEngine, BarcodeEngineAdapter>();
  private readonly config = getBarcodeConfig();

  constructor(private readonly overrides: BarcodeServiceOptions = {}) {}

  private getAllowedFormats(): BarcodeFormat[] {
    return this.overrides.allowedFormats?.length
      ? this.overrides.allowedFormats
      : this.config.allowedFormats;
  }

  private getEngineOrder(): BarcodeEngine[] {
    const requested = this.overrides.engine ?? this.config.engine;
    return resolveEngines(requested);
  }

  private async getAdapter(engine: BarcodeEngine): Promise<BarcodeEngineAdapter> {
    let adapter = this.adapters.get(engine);
    if (!adapter) {
      adapter = createAdapter(engine);
      this.adapters.set(engine, adapter);
    }
    await adapter.initialize();
    return adapter;
  }

  private buildOptions(): BarcodeDecodeOptions {
    return { allowedFormats: this.getAllowedFormats() };
  }

  async decodeFile(file: File): Promise<BarcodeScanResult> {
    if (!isBrowser()) {
      return buildErrorResult('quagga', 0, 'unsupported', 'Barcode decoding is only available in the browser.');
    }
    const engines = this.getEngineOrder();
    if (engines.length === 0) {
      return buildErrorResult('quagga', 0, 'unsupported', 'No barcode engines are enabled');
    }

    const options = this.buildOptions();
    const start = nowMs();
    for (const engine of engines) {
      try {
        const adapter = await this.getAdapter(engine);
        const result = await adapter.decodeFromFile(file, options);
        if (result) {
          result.engine = engine;
          result.durationMs = result.durationMs ?? nowMs() - start;
          return result;
        }
      } catch (error) {
        console.warn(`Barcode engine ${engine} failed:`, error);
      }
    }

    const duration = nowMs() - start;
    return buildErrorResult(engines[0], duration, 'not_found');
  }

  async decodeCanvas(canvas: HTMLCanvasElement): Promise<BarcodeScanResult> {
    if (!isBrowser()) {
      return buildErrorResult('quagga', 0, 'unsupported', 'Barcode decoding is only available in the browser.');
    }
    const engines = this.getEngineOrder();
    const options = this.buildOptions();
    const start = nowMs();

    for (const engine of engines) {
      try {
        const adapter = await this.getAdapter(engine);
        const result = await adapter.decodeFromCanvas(canvas, options);
        if (result) {
          result.engine = engine;
          result.durationMs = result.durationMs ?? nowMs() - start;
          return result;
        }
      } catch (error) {
        console.warn(`Barcode engine ${engine} failed:`, error);
      }
    }

    const duration = nowMs() - start;
    return buildErrorResult(engines[0], duration, 'not_found');
  }

  async dispose(): Promise<void> {
    await Promise.all(Array.from(this.adapters.values()).map((adapter) => adapter.dispose()));
    this.adapters.clear();
  }

  // Legacy compatibility APIs – will be replaced in upcoming phases
  async scanFromImage(file: File): Promise<BarcodeScanResult[]> {
    const result = await this.decodeFile(file);
    return result.ok ? [result] : [];
  }

  async checkCameraPermission(): Promise<boolean> {
    if (!isBrowser()) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  async initializeScanner(
    _options: {
      target?: HTMLElement | null;
      formats?: string[];
      frequency?: number;
    } = {}
  ): Promise<void> {
    console.warn('barcodeService.initializeScanner is a legacy API and will be replaced in upcoming updates.');
  }

  async startScanning(
    _onDetected: (result: BarcodeScanResult) => void,
    onError?: (error: Error) => void,
  ): Promise<void> {
    onError?.(new Error('Live barcode scanning will be implemented in a subsequent update.'));
  }

  stopScanning(): void {
    void this.dispose();
  }

  cleanup(): void {
    void this.dispose();
  }
}

export const barcodeService = new BarcodeService();
