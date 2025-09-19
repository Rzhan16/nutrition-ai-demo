import type { BarcodeFormat, BarcodeScanResult, BarcodeEngine } from '@/lib/types';

export const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const QUAGGA_READER_MAP: Record<BarcodeFormat, string[]> = {
  EAN13: ['ean_reader'],
  EAN8: ['ean_8_reader'],
  UPC: ['upc_reader'],
  UPCE: ['upc_e_reader'],
  CODE128: ['code_128_reader'],
  CODE39: ['code_39_reader'],
};

export const mapFormatsToQuagga = (formats: BarcodeFormat[]): string[] => {
  const readers = new Set<string>();
  formats.forEach((format) => {
    const mapped = QUAGGA_READER_MAP[format];
    if (mapped) {
      mapped.forEach((reader) => readers.add(reader));
    }
  });
  return readers.size > 0 ? Array.from(readers) : QUAGGA_READER_MAP.EAN13;
};

export const nowMs = (): number => {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
};

export const toBarcodeResult = (
  engine: BarcodeEngine,
  code: string,
  format: string,
  confidence: number,
  durationMs: number,
  rawValue?: unknown
): BarcodeScanResult => ({
  ok: true,
  code,
  format,
  confidence,
  durationMs,
  engine,
  rawValue,
});

export const buildErrorResult = (
  engine: BarcodeEngine,
  durationMs: number,
  errorCode: BarcodeScanResult['errorCode'],
  errorMessage?: string
): BarcodeScanResult => ({
  ok: false,
  engine,
  durationMs,
  errorCode,
  errorMessage,
});

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File reading failed'));
    reader.readAsDataURL(file);
  });

export const loadImageFromFile = async (file: File): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImageFromUrl(url);
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const loadImageFromUrl = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = url;
  });

export const ensureCanvasFromImage = (image: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not available');
  }
  ctx.drawImage(image, 0, 0);
  return canvas;
};
