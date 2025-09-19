const createWorkerMock = jest.fn();

jest.mock('tesseract.js', () => ({
  __esModule: true,
  createWorker: (...args: unknown[]) => createWorkerMock(...args),
  OEM: { LSTM_ONLY: 1 },
  PSM: { AUTO: 3 },
}));

import { OCRService } from '@/lib/ocr';

const createCanvasContext = () => ({
  drawImage: jest.fn(),
  getImageData: jest.fn(() => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  })),
  putImageData: jest.fn(),
});

beforeAll(() => {
  Object.defineProperty(globalThis, 'Image', {
    writable: true,
    value: class MockImage {
      onload: (() => void) | null = null;
      onerror: ((error: unknown) => void) | null = null;

      set src(_value: string) {
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    writable: true,
    value: jest.fn(createCanvasContext),
  });

  Object.defineProperty(window.URL, 'createObjectURL', {
    writable: true,
    value: jest.fn(() => 'blob:mock'),
  });

  Object.defineProperty(window.URL, 'revokeObjectURL', {
    writable: true,
    value: jest.fn(),
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  createWorkerMock.mockReset();
});

const createWorker = (result: any) => {
  const worker = {
    load: jest.fn().mockResolvedValue(undefined),
    loadLanguage: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    setParameters: jest.fn().mockResolvedValue(undefined),
    detect: jest.fn().mockResolvedValue({ data: { orientation: { degrees: 0 } } }),
    recognize: jest.fn().mockResolvedValue(result),
    terminate: jest.fn().mockResolvedValue(undefined),
  };
  createWorkerMock.mockResolvedValue(worker);
  return worker;
};

describe('OCRService.processImage', () => {
  it('returns ok result when confidence is high', async () => {
    const worker = createWorker({
      data: {
        text: 'High confidence text',
        words: [
          { text: 'High', confidence: 95, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
          { text: 'Confidence', confidence: 92, bbox: { x0: 1, y0: 1, x1: 2, y1: 2 } },
        ],
        confidence: 93,
      },
    });
    const service = new OCRService();
    const file = new File(['mock'], 'label.png', { type: 'image/png' });

    const result = await service.processImage(file, { timeoutMs: 1000 });

    expect(worker.recognize).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.errorCode).toBeUndefined();
    expect(result.text).toBe('High confidence text');
  });

  it('flags low confidence results for manual review', async () => {
    createWorker({
      data: {
        text: 'low confidence text',
        words: [
          { text: 'low', confidence: 40, bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
        ],
        confidence: 40,
      },
    });
    const service = new OCRService();
    const file = new File(['mock'], 'label.png', { type: 'image/png' });

    const result = await service.processImage(file, { timeoutMs: 1000 });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('ocr_low_confidence');
    expect(result.errorMessage).toBe('OCR confidence below threshold');
  });

  it('returns timeout error when recognition exceeds timeout', async () => {
    jest.useFakeTimers();
    const worker = createWorker({
      data: {
        text: '',
        words: [],
        confidence: 0,
      },
    });
    worker.recognize.mockReturnValue(new Promise(() => undefined));

    const service = new OCRService();
    const file = new File(['mock'], 'label.png', { type: 'image/png' });
    const promise = service.processImage(file, { timeoutMs: 10 });

    jest.runOnlyPendingTimers();
    const result = await promise;
    jest.useRealTimers();

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('ocr_timeout');
  });

  it('honours aborted signals before starting work', async () => {
    createWorker({
      data: {
        text: 'unused',
        words: [],
        confidence: 100,
      },
    });
    const service = new OCRService();
    const controller = new AbortController();
    controller.abort();
    const file = new File(['mock'], 'label.png', { type: 'image/png' });

    const result = await service.processImage(file, { signal: controller.signal });

    expect(result.ok).toBe(false);
    expect(result.wasAborted).toBe(true);
    expect(result.errorCode).toBe('ocr_failed');
  });
});
