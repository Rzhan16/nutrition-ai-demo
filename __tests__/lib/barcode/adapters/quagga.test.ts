jest.mock('quagga', () => ({
  __esModule: true,
  default: {
    decodeSingle: jest.fn(),
  },
}));

import Quagga from 'quagga';
import type { BarcodeFormat } from '@/lib/types';
import { QuaggaAdapter } from '@/lib/barcode/adapters/quagga';

describe('QuaggaAdapter', () => {
  const formats: BarcodeFormat[] = ['EAN13'];

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns a scan result when decode succeeds', async () => {
    const adapter = new QuaggaAdapter();
    const canvas = document.createElement('canvas');
    jest.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,quagga');

    const decodeSingleMock = (Quagga as unknown as { decodeSingle: jest.Mock }).decodeSingle;
    decodeSingleMock.mockImplementation((_config, callback) => {
      callback({
        codeResult: {
          code: '1234567890123',
          format: 'EAN13',
          decodedCodes: [],
        },
      } as any);
    });

    const result = await adapter.decodeFromCanvas(canvas, { allowedFormats: formats });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        code: '1234567890123',
        format: 'EAN13',
        engine: 'quagga',
      }),
    );
  });

  it('returns null when the decoder produces no code (timeout)', async () => {
    const adapter = new QuaggaAdapter();
    const canvas = document.createElement('canvas');
    jest.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,timeout');

    const decodeSingleMock = (Quagga as unknown as { decodeSingle: jest.Mock }).decodeSingle;
    decodeSingleMock.mockImplementation((_config, callback) => {
      callback(null);
    });

    const result = await adapter.decodeFromCanvas(canvas, { allowedFormats: formats });
    expect(result).toBeNull();
  });

  it('returns null when the result is missing a code (unsupported format)', async () => {
    const adapter = new QuaggaAdapter();
    const canvas = document.createElement('canvas');
    jest.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,unsupported');

    const decodeSingleMock = (Quagga as unknown as { decodeSingle: jest.Mock }).decodeSingle;
    decodeSingleMock.mockImplementation((_config, callback) => {
      callback({ codeResult: {} } as any);
    });

    const result = await adapter.decodeFromCanvas(canvas, { allowedFormats: formats });
    expect(result).toBeNull();
  });
});
