import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock browser APIs
Object.defineProperty(window, 'fetch', {
  writable: true,
  value: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          engine: 'paddle',
          text: 'Mocked OCR text',
          words: [
            {
              text: 'Mocked',
              confidence: 0.9,
              bbox: [0, 0, 10, 10],
              line_id: 0,
              block_id: 0,
            },
          ],
          orientation: { angle: 0, confidence: 1 },
          cached: false,
          elapsed_ms: 1234,
        }),
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
