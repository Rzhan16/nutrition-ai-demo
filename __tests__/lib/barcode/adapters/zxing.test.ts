jest.mock('@zxing/browser', () => ({
  __esModule: true,
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    getHints: jest.fn().mockReturnValue(new Map()),
    setHints: jest.fn(),
    decodeFromCanvas: jest.fn(),
    reset: jest.fn(),
  })),
  DecodeHintType: {
    TRY_HARDER: 'TRY_HARDER',
    POSSIBLE_FORMATS: 'POSSIBLE_FORMATS',
  },
}));

jest.mock('@zxing/library', () => ({
  __esModule: true,
  BarcodeFormat: {
    EAN_13: 'EAN_13',
    EAN_8: 'EAN_8',
    UPC_A: 'UPC_A',
    UPC_E: 'UPC_E',
    CODE_128: 'CODE_128',
    CODE_39: 'CODE_39',
  },
  DecodeHintType: {
    TRY_HARDER: 'TRY_HARDER',
    POSSIBLE_FORMATS: 'POSSIBLE_FORMATS',
  },
}));

import type { BarcodeFormat } from '@/lib/types';
import { ZXingAdapter } from '@/lib/barcode/adapters/zxing';

describe('ZXingAdapter', () => {
  const formats: BarcodeFormat[] = ['EAN13'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a scan result when ZXing succeeds', async () => {
    const adapter = new ZXingAdapter();
    const canvas = document.createElement('canvas');
    await adapter.initialize();
    type MockReader = {
      decodeFromCanvas: jest.Mock;
      getHints: jest.Mock;
      setHints: jest.Mock;
    };
    const reader = (adapter as unknown as { reader: MockReader }).reader;

    reader.decodeFromCanvas.mockResolvedValue({
      getText: () => '4900000000000',
      getBarcodeFormat: () => ({ toString: () => 'EAN_13' }),
    });

    const result = await adapter.decodeFromCanvas(canvas, { allowedFormats: formats });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        code: '4900000000000',
        engine: 'zxing',
      }),
    );
  });

  it('returns null when ZXing throws (timeout)', async () => {
    const adapter = new ZXingAdapter();
    const canvas = document.createElement('canvas');
    await adapter.initialize();
    const reader = (adapter as unknown as { reader: { decodeFromCanvas: jest.Mock } }).reader;

    reader.decodeFromCanvas.mockRejectedValue(new Error('timeout'));

    const result = await adapter.decodeFromCanvas(canvas, { allowedFormats: formats });
    expect(result).toBeNull();
  });

  it('returns null when ZXing cannot decode (unsupported)', async () => {
    const adapter = new ZXingAdapter();
    const canvas = document.createElement('canvas');
    await adapter.initialize();
    const reader = (adapter as unknown as { reader: { decodeFromCanvas: jest.Mock } }).reader;

    reader.decodeFromCanvas.mockResolvedValue(null);

    const result = await adapter.decodeFromCanvas(canvas, { allowedFormats: formats });
    expect(result).toBeNull();
  });
});
