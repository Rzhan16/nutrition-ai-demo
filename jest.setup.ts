import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock browser APIs
Object.defineProperty(window, 'fetch', {
  writable: true,
  value: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  ),
});

Object.defineProperty(global, 'URL', {
  writable: true,
  value: {
    createObjectURL: jest.fn(() => 'mocked-url'),
    revokeObjectURL: jest.fn(),
  },
});

Object.defineProperty(window, 'HTMLCanvasElement', {
  writable: true,
  value: {
    prototype: {
      getContext: jest.fn(() => ({
        drawImage: jest.fn(),
        getImageData: jest.fn(() => ({
          data: new Uint8ClampedArray(4),
          width: 1,
          height: 1,
        })),
        putImageData: jest.fn(),
      })),
    },
  },
});

// Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(() =>
      Promise.resolve({
        getTracks: () => [{ stop: jest.fn() }],
      })
    ),
    enumerateDevices: jest.fn(() => Promise.resolve([])),
  },
});

// Mock Tesseract.js
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(() => ({
    load: jest.fn(),
    loadLanguage: jest.fn(),
    initialize: jest.fn(),
    recognize: jest.fn(() =>
      Promise.resolve({
        data: {
          text: 'Mocked OCR text',
          confidence: 85,
        },
      })
    ),
    terminate: jest.fn(),
  })),
}));

// Mock ZXing
jest.mock('@zxing/browser', () => ({
  BrowserBarcodeReader: jest.fn(() => ({
    decodeFromCanvas: jest.fn(),
  })),
}));

// Mock Quagga
jest.mock('quagga', () => ({
  init: jest.fn((config: unknown, callback: (error: Error | null) => void) => callback(null)),
  start: jest.fn(),
  stop: jest.fn(),
  onDetected: jest.fn(),
  onProcessed: jest.fn(),
  decodeSingle: jest.fn(),
}));

// Mock html5-qrcode
jest.mock('html5-qrcode', () => ({
  Html5QrcodeScanner: jest.fn(() => ({
    render: jest.fn(),
    clear: jest.fn(),
  })),
  Html5QrcodeScanType: {
    SCAN_TYPE_CAMERA: 'camera',
  },
}));

// Global test timeout
jest.setTimeout(10000);
