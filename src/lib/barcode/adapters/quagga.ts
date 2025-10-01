import Quagga from 'quagga';
import type { BarcodeFormat, BarcodeScanResult } from '@/lib/types';
import { mapFormatsToQuagga, nowMs, toBarcodeResult } from '../utils';
import type { BarcodeDecodeOptions, BarcodeEngineAdapter } from '../types';

const ENGINE_ID = 'quagga' as const;

type QuaggaDecodedCode = {
  error?: number | null;
};

type QuaggaCodeResult = {
  code?: string;
  format?: string;
  decodedCodes?: QuaggaDecodedCode[] | null;
};

type QuaggaResult = {
  codeResult?: QuaggaCodeResult | null;
};

type QuaggaJSConfig = {
  src: string;
  numOfWorkers: number;
  locate: boolean;
  decoder: {
    readers: string[];
  };
};

const calculateConfidence = (result: QuaggaResult | null): number => {
  try {
    const codes = result?.codeResult?.decodedCodes;
    if (!Array.isArray(codes) || codes.length === 0) {
      return 1;
    }

    const valid = codes.filter((item) => typeof item?.error !== 'undefined');
    if (valid.length === 0) {
      return 1;
    }

    const totalError = valid.reduce((sum, item) => sum + Math.abs(item?.error ?? 0), 0);
    const confidence = 1 - totalError / valid.length;
    return Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 1;
  } catch {
    return 1;
  }
};

const runDecodeSingle = (config: QuaggaJSConfig): Promise<QuaggaResult | null> =>
  new Promise((resolve) => {
    Quagga.decodeSingle(config, (result) => {
      resolve((result as QuaggaResult | undefined) ?? null);
    });
  });

const createDecodeConfig = (
  dataUrl: string,
  formats: BarcodeFormat[],
): QuaggaJSConfig => ({
  src: dataUrl,
  numOfWorkers: 0,
  locate: true,
  decoder: {
    readers: mapFormatsToQuagga(formats),
  },
});

export class QuaggaAdapter implements BarcodeEngineAdapter {
  public readonly id = ENGINE_ID;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  async decodeFromCanvas(
    canvas: HTMLCanvasElement,
    options: BarcodeDecodeOptions,
  ): Promise<BarcodeScanResult | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const start = nowMs();
    const dataUrl = canvas.toDataURL('image/png');
    const result = await runDecodeSingle(createDecodeConfig(dataUrl, options.allowedFormats));
    const duration = nowMs() - start;

    if (!result?.codeResult?.code) {
      return null;
    }

    return toBarcodeResult(
      this.id,
      result.codeResult.code,
      (result.codeResult.format as string | undefined) ?? 'UNKNOWN',
      calculateConfidence(result),
      duration,
      result,
    );
  }

  async decodeFromFile(
    file: File,
    options: BarcodeDecodeOptions,
  ): Promise<BarcodeScanResult | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Unable to read file'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
      reader.readAsDataURL(file);
    });

    const start = nowMs();
    const result = await runDecodeSingle(createDecodeConfig(dataUrl, options.allowedFormats));
    const duration = nowMs() - start;

    if (!result?.codeResult?.code) {
      return null;
    }

    return toBarcodeResult(
      this.id,
      result.codeResult.code,
      (result.codeResult.format as string | undefined) ?? 'UNKNOWN',
      calculateConfidence(result),
      duration,
      result,
    );
  }

  async dispose(): Promise<void> {
    this.initialized = false;
  }
}
