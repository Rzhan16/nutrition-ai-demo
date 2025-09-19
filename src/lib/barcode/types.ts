import type { BarcodeEngine, BarcodeFormat, BarcodeScanResult } from '@/lib/types';

export interface BarcodeDecodeOptions {
  allowedFormats: BarcodeFormat[];
}

export interface BarcodeEngineAdapter {
  readonly id: BarcodeEngine;
  initialize(): Promise<void>;
  decodeFromCanvas(
    canvas: HTMLCanvasElement,
    options: BarcodeDecodeOptions
  ): Promise<BarcodeScanResult | null>;
  decodeFromFile(
    file: File,
    options: BarcodeDecodeOptions
  ): Promise<BarcodeScanResult | null>;
  dispose(): Promise<void> | void;
}

export interface FrameAnalysis {
  timestamp: number;
  code?: string;
  confidence?: number;
}

export type BarcodeEngineFactory = () => Promise<BarcodeEngineAdapter>;
