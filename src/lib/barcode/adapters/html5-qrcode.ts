import type { BarcodeScanResult } from '@/lib/types';
import { nowMs, toBarcodeResult } from '../utils';
import type { BarcodeDecodeOptions, BarcodeEngineAdapter } from '../types';

const ENGINE_ID = 'html5-qrcode' as const;
const TEMP_ELEMENT_ID = 'html5-qrcode-temp-element';

type Html5Module = typeof import('html5-qrcode');

type Html5QrcodeScanResult =
  | string
  | {
      decodedText: string;
      format?: { formatName?: string };
      [key: string]: unknown;
    };

const loadModule = async (): Promise<Html5Module> => import('html5-qrcode');

const ensureElement = (): HTMLElement => {
  let element = document.getElementById(TEMP_ELEMENT_ID);
  if (!element) {
    element = document.createElement('div');
    element.id = TEMP_ELEMENT_ID;
    element.style.position = 'fixed';
    element.style.width = '1px';
    element.style.height = '1px';
    element.style.top = '-1000px';
    element.style.left = '-1000px';
    document.body.appendChild(element);
  }
  return element;
};

export class Html5QrcodeAdapter implements BarcodeEngineAdapter {
  public readonly id = ENGINE_ID;
  private instance: import('html5-qrcode').Html5Qrcode | null = null;
  private module: Html5Module | null = null;

  async initialize(): Promise<void> {
    if (this.instance) return;
    if (typeof document === 'undefined') {
      throw new Error('html5-qrcode requires a browser environment');
    }
    this.module = await loadModule();
    const { Html5Qrcode } = this.module;
    ensureElement();
    this.instance = new Html5Qrcode(TEMP_ELEMENT_ID);
  }

  async decodeFromCanvas(
    _canvas: HTMLCanvasElement,
    _options: BarcodeDecodeOptions,
  ): Promise<BarcodeScanResult | null> {
    void _canvas;
    void _options;
    // html5-qrcode does not provide a documented API to decode directly from canvas.
    return null;
  }

  async decodeFromFile(
    file: File,
    _options: BarcodeDecodeOptions,
  ): Promise<BarcodeScanResult | null> {
    void _options;
    if (typeof document === 'undefined') {
      return null;
    }
    if (!this.instance) {
      await this.initialize();
    }
    if (!this.instance || !this.module) {
      return null;
    }

    const start = nowMs();
    try {
      const result = (await this.instance.scanFile(file, false)) as Html5QrcodeScanResult;

      if (!result) {
        return null;
      }

      const duration = nowMs() - start;
      const decodedText = typeof result === 'string' ? result : result.decodedText;
      if (!decodedText) {
        return null;
      }
      const formatName = typeof result === 'string' ? 'UNKNOWN' : result.format?.formatName ?? 'UNKNOWN';

      return toBarcodeResult(
        this.id,
        decodedText,
        formatName,
        1,
        duration,
        result,
      );
    } catch {
      return null;
    }
  }

  async dispose(): Promise<void> {
    if (this.instance) {
      await this.instance.clear();
      this.instance = null;
    }
  }
}
