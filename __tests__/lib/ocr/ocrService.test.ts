import { jest } from '@jest/globals';

jest.mock('@/lib/ocr/paddle-client', () => ({
  callPaddleOCR: jest.fn(),
}));

import { ocrService } from '@/lib/ocr';
import { callPaddleOCR, type PaddleOCRResponse } from '@/lib/ocr/paddle-client';

const createMockFile = () => new File(['dummy'], 'test.png', { type: 'image/png' });

const makeResponse = (overrides: Partial<PaddleOCRResponse> = {}): PaddleOCRResponse => ({
  engine: 'paddle',
  text: 'Mocked OCR text',
  words: [
    {
      text: 'Mocked',
      confidence: 0.92,
      bbox: [0, 0, 10, 10],
      line_id: 0,
      block_id: 0,
    },
  ],
  orientation: { angle: 0, confidence: 1 },
  cached: false,
  elapsed_ms: 420,
  ...overrides,
});

describe('OCRService.processImage', () => {
  beforeEach(() => {
    (callPaddleOCR as jest.Mock).mockReset();
    delete process.env.NEXT_PUBLIC_OCR_CONFIDENCE_MIN;
  });

  it('returns ok result for high confidence responses', async () => {
    (callPaddleOCR as jest.Mock).mockResolvedValue(
      makeResponse({
        text: 'Vitamin D3 1000 IU',
        words: [
          { text: 'Vitamin', confidence: 0.95, bbox: [0, 0, 10, 10], line_id: 0, block_id: 0 },
          { text: 'D3', confidence: 0.9, bbox: [12, 0, 20, 10], line_id: 0, block_id: 0 },
        ],
      })
    );

    const result = await ocrService.processImage(createMockFile());

    expect(result.ok).toBe(true);
    expect(result.text).toBe('Vitamin D3 1000 IU');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.words?.length).toBe(2);
    expect(result.errorCode).toBeUndefined();
  });

  it('marks result as low confidence when below threshold', async () => {
    process.env.NEXT_PUBLIC_OCR_CONFIDENCE_MIN = '0.8';
    (callPaddleOCR as jest.Mock).mockResolvedValue(
      makeResponse({
        words: [
          { text: 'Low', confidence: 0.5, bbox: [0, 0, 10, 10], line_id: 0, block_id: 0 },
        ],
        text: 'Low confidence text',
      })
    );

    const result = await ocrService.processImage(createMockFile());

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('ocr_low_confidence');
    expect(result.confidence).toBeLessThan(0.8);
  });

  it('returns failure result when the OCR service throws', async () => {
    (callPaddleOCR as jest.Mock).mockRejectedValue(new Error('network failure'));

    const result = await ocrService.processImage(createMockFile());

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('ocr_failed');
    expect(result.errorMessage).toContain('network failure');
  });
});
