export type OCRWord = {
  text: string;
  confidence: number;
  bbox: number[];
  line_id: number;
  block_id: number;
};

export type PaddleOCRResp = {
  engine: string;
  text: string;
  words: OCRWord[];
  orientation: { angle: number; confidence: number };
  cached: boolean;
  elapsed_ms: number;
  digest: string;
  filtered_count: number;
  corrected_count: number;
};

function ensureEnv(name: string): string {
  const value =
    process.env[name] ?? process.env[`NEXT_PUBLIC_${name}` as keyof NodeJS.ProcessEnv];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function callPaddleOCR(
  file: Blob,
  signal?: AbortSignal
): Promise<PaddleOCRResp> {
  const baseUrl = ensureEnv('PADDLE_OCR_URL');
  const timeoutMs = Number(process.env.OCR_TIMEOUT_MS ?? 10_000);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), {
        once: true,
      });
    }
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/ocr`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`paddle ocr http ${response.status}`);
    }

    return (await response.json()) as PaddleOCRResp;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type { PaddleOCRResp as PaddleOCRResponse };
