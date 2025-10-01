const createWorkerMock = jest.fn();
const preprocessOcrSourceMock = jest.fn();
const applyDynamicPageSegModeMock = jest.fn();
const getOcrWorkerMock = jest.fn();
let createElementSpy: jest.SpyInstance<ReturnType<Document['createElement']>, Parameters<Document['createElement']>>;

jest.mock('@/lib/ocr/worker', () => ({
  __esModule: true,
  preprocessOcrSource: (...args: unknown[]) => preprocessOcrSourceMock(...args),
  applyDynamicPageSegMode: (...args: unknown[]) => applyDynamicPageSegModeMock(...args),
  getOcrWorker: (...args: unknown[]) => getOcrWorkerMock(...args),
}));

jest.mock('tesseract.js', () => {
  const OEM = { LSTM_ONLY: 1 } as const;
  const PSM = { AUTO: 3, SINGLE_LINE: 13, SPARSE_TEXT: 12 } as const;

  const exported = {
    __esModule: true,
    OEM,
    PSM,
    createWorker: (...args: unknown[]) => createWorkerMock(...args),
    default: {
      createWorker: (...args: unknown[]) => createWorkerMock(...args),
    },
  };

  return exported;
});

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
  const originalCreateElement = document.createElement.bind(document);

  Object.defineProperty(globalThis, 'Image', {
    writable: true,
    value: class MockImage {
      width = 800;
      height = 600;
      naturalWidth = 800;
      naturalHeight = 600;
      onload: (() => void) | null = null;
      onerror: ((error: unknown) => void) | null = null;

      set src(_value: string) {
        setTimeout(() => {
          this.onload?.();
        }, 0);
      }
    },
  });

  createElementSpy = jest
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName === 'canvas') {
        Object.defineProperty(element, 'getContext', {
          configurable: true,
          writable: true,
          value: jest.fn(createCanvasContext),
        });
      }
      return element;
    });

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
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

afterAll(() => {
  createElementSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  createWorkerMock.mockReset();
  preprocessOcrSourceMock.mockResolvedValue({
    canvas: (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      return canvas;
    })(),
    meta: {
      width: 800,
      height: 600,
      pixelCount: 480_000,
      thresholdOn: true,
    },
  });
  applyDynamicPageSegModeMock.mockResolvedValue(3);
});

type WorkerResult = {
  data: {
    text: string;
    words: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
    confidence: number;
  };
};

type MockWorker = {
  load: jest.Mock<Promise<void>>;
  loadLanguage: jest.Mock<Promise<void>>;
  initialize: jest.Mock<Promise<void>>;
  reinitialize: jest.Mock<Promise<void>>;
  setParameters: jest.Mock<Promise<void>>;
  detect: jest.Mock<Promise<{ data: { orientation: { degrees: number } } }>>;
  recognize: jest.Mock<Promise<WorkerResult>>;
  terminate: jest.Mock<Promise<void>>;
};

const createWorker = (result: WorkerResult): MockWorker => {
  const worker: MockWorker = {
    load: jest.fn().mockResolvedValue(undefined),
    loadLanguage: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
    reinitialize: jest.fn().mockResolvedValue(undefined),
    setParameters: jest.fn().mockResolvedValue(undefined),
    detect: jest.fn().mockResolvedValue({ data: { orientation: { degrees: 0 } } }),
    recognize: jest.fn().mockResolvedValue(result),
    terminate: jest.fn().mockResolvedValue(undefined),
  };
  createWorkerMock.mockResolvedValue(worker);
  getOcrWorkerMock.mockResolvedValue(worker);
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
    const worker = createWorker({
      data: {
        text: '',
        words: [],
        confidence: 0,
      },
    });
    worker.recognize.mockRejectedValue(new Error('OCR timeout'));

    const service = new OCRService();
    const file = new File(['mock'], 'label.png', { type: 'image/png' });
    const result = await service.processImage(file, { timeoutMs: 10 });

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
