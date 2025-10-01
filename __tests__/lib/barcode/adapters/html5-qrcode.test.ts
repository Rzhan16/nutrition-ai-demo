jest.mock('html5-qrcode', () => ({
  __esModule: true,
  Html5Qrcode: jest.fn().mockImplementation(() => ({
    scanFile: jest.fn(),
    clear: jest.fn(),
  })),
}));
import { Html5QrcodeAdapter } from '@/lib/barcode/adapters/html5-qrcode';

describe('Html5QrcodeAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('returns a scan result when scanFile succeeds', async () => {
    const adapter = new Html5QrcodeAdapter();
    const file = new File(['test'], 'barcode.png', { type: 'image/png' });
    type Html5QrcodeInstance = { scanFile: jest.Mock };
    const instance = (await adapter.initialize(), (adapter as unknown as { instance: Html5QrcodeInstance }).instance);

    instance.scanFile.mockResolvedValue({
      decodedText: '9876543210987',
      format: { formatName: 'EAN_13' },
    });

    const result = await adapter.decodeFromFile(file, { allowedFormats: ['EAN13'] });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        code: '9876543210987',
        engine: 'html5-qrcode',
      }),
    );
  });

  it('returns null when scanFile rejects (timeout)', async () => {
    const adapter = new Html5QrcodeAdapter();
    const file = new File(['test'], 'barcode.png', { type: 'image/png' });
    const instance = (await adapter.initialize(), (adapter as unknown as { instance: Html5QrcodeInstance }).instance);

    instance.scanFile.mockRejectedValue(new Error('timeout'));

    const result = await adapter.decodeFromFile(file, { allowedFormats: ['EAN13'] });
    expect(result).toBeNull();
  });

  it('returns null when document is unavailable (unsupported)', async () => {
    const adapter = new Html5QrcodeAdapter();
    const file = new File(['test'], 'barcode.png', { type: 'image/png' });
    const originalDocument = globalThis.document;
    // @ts-expect-error intentionally unset for test
    globalThis.document = undefined;
    try {
      const result = await adapter.decodeFromFile(file, { allowedFormats: ['EAN13'] });
      expect(result).toBeNull();
    } finally {
      globalThis.document = originalDocument;
    }
  });
});
