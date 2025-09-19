import type { BarcodeScanResult, OCRResult } from '@/lib/types';
import { smartScanReducer, type SmartScanState } from '@/components/analyze/SmartScanContext';

const createState = (overrides: Partial<SmartScanState> = {}): SmartScanState => ({
  step: 'idle',
  progress: 0,
  source: null,
  barcodeResult: null,
  ocrResult: null,
  analysisResult: null,
  searchResult: null,
  file: null,
  forceOCR: false,
  manualText: undefined,
  dsld: { status: 'idle', data: null },
  ...overrides,
});

describe('smartScanReducer', () => {
  it('moves to barcode scanning on START_CAMERA', () => {
    const state = smartScanReducer(createState(), { type: 'START_CAMERA' });
    expect(state.step).toBe('scanning_barcode');
    expect(state.progress).toBe(10);
    expect(state.source).toBe('camera');
  });

  it('goes to OCR fallback when barcode fails', () => {
    const fallback: BarcodeScanResult = {
      ok: false,
      engine: 'quagga',
      durationMs: 10,
      errorCode: 'barcode_timeout',
    };
    const state = smartScanReducer(createState({ step: 'scanning_barcode' }), {
      type: 'BARCODE_FAILED',
      result: fallback,
    });

    expect(state.step).toBe('ocr');
    expect(state.barcodeResult).toEqual(fallback);
  });

  it('skips OCR when barcode succeeds and forceOCR is disabled', () => {
    const barcode: BarcodeScanResult = {
      ok: true,
      code: '12345',
      format: 'EAN13',
      confidence: 0.9,
      durationMs: 8,
      engine: 'quagga',
    };
    const state = smartScanReducer(createState(), {
      type: 'BARCODE_SUCCEEDED',
      result: barcode,
    });

    expect(state.step).toBe('analyzing');
    expect(state.progress).toBe(55);
  });

  it('moves into manual correction when OCR confidence is low', () => {
    const ocrResult: OCRResult = {
      ok: true,
      text: 'noisy text',
      confidence: 0.4,
      durationMs: 12,
    };
    const state = smartScanReducer(createState(), {
      type: 'OCR_LOW_CONFIDENCE',
      result: ocrResult,
    });

    expect(state.step).toBe('manual_correction');
    expect(state.progress).toBe(50);
    expect(state.manualText).toBe('noisy text');
    expect(state.errorCode).toBe('ocr_low_confidence');
  });

  it('records analyze failure with canonical code', () => {
    const state = smartScanReducer(createState({ step: 'analyzing' }), {
      type: 'ANALYZE_FAILURE',
      errorMessage: 'Server error',
    });

    expect(state.step).toBe('error');
    expect(state.errorCode).toBe('analyze_failed');
    expect(state.errorMessage).toBe('Server error');
  });

  it('records search failure with canonical code', () => {
    const state = smartScanReducer(createState({ step: 'searching' }), {
      type: 'SEARCH_FAILURE',
      errorMessage: 'Search offline',
    });

    expect(state.errorCode).toBe('search_failed');
    expect(state.progress).toBe(85);
  });
});
