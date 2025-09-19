import {
  BARCODE_ENGINE_OPTIONS,
  BARCODE_FORMATS,
  type BarcodeEngineOption,
  type BarcodeFormat,
} from '@/lib/types';

export interface BarcodeRuntimeConfig {
  engine: BarcodeEngineOption;
  allowedFormats: BarcodeFormat[];
  framesPerSecond: number;
  consensusThreshold: number;
  timeoutMs: number;
}

const DEFAULT_ENGINE: BarcodeEngineOption = 'auto';
const DEFAULT_FORMATS: BarcodeFormat[] = [...BARCODE_FORMATS];
const DEFAULT_FPS = 10;
const DEFAULT_CONSENSUS = 3;
const DEFAULT_TIMEOUT_MS = 7000;

const parseInteger = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const clampPositive = (value: number | undefined, fallback: number, min = 1, max?: number): number => {
  if (value === undefined || Number.isNaN(value)) return fallback;
  const clamped = Math.max(min, value);
  return max !== undefined ? Math.min(clamped, max) : clamped;
};

const parseEngine = (raw: string | undefined): BarcodeEngineOption => {
  if (!raw) return DEFAULT_ENGINE;
  const normalized = raw.toLowerCase();
  if (BARCODE_ENGINE_OPTIONS.includes(normalized as BarcodeEngineOption)) {
    return normalized as BarcodeEngineOption;
  }
  return DEFAULT_ENGINE;
};

const parseFormats = (raw: string | undefined): BarcodeFormat[] => {
  if (!raw) return DEFAULT_FORMATS;
  const tokens = raw
    .split(',')
    .map(token => token.trim().toUpperCase())
    .filter(Boolean) as BarcodeFormat[];

  const valid = tokens.filter(format => BARCODE_FORMATS.includes(format));
  return valid.length > 0 ? valid : DEFAULT_FORMATS;
};

export const BARCODE_DEFAULT_CONFIG: BarcodeRuntimeConfig = {
  engine: DEFAULT_ENGINE,
  allowedFormats: DEFAULT_FORMATS,
  framesPerSecond: DEFAULT_FPS,
  consensusThreshold: DEFAULT_CONSENSUS,
  timeoutMs: DEFAULT_TIMEOUT_MS,
};

export const getBarcodeConfig = (): BarcodeRuntimeConfig => {
  const rawEngine = process.env.NEXT_PUBLIC_BARCODE_ENGINE;
  const rawFormats = process.env.NEXT_PUBLIC_BARCODE_FORMATS;
  const rawFps = parseInteger(process.env.NEXT_PUBLIC_BARCODE_FPS);
  const rawConsensus = parseInteger(process.env.NEXT_PUBLIC_BARCODE_CONSENSUS);
  const rawTimeout = parseInteger(process.env.NEXT_PUBLIC_BARCODE_TIMEOUT_MS);

  return {
    engine: parseEngine(rawEngine),
    allowedFormats: parseFormats(rawFormats),
    framesPerSecond: clampPositive(rawFps, DEFAULT_FPS, 1, 30),
    consensusThreshold: clampPositive(rawConsensus, DEFAULT_CONSENSUS, 1, 10),
    timeoutMs: clampPositive(rawTimeout, DEFAULT_TIMEOUT_MS, 1000),
  };
};

export type { BarcodeEngineOption, BarcodeFormat };
