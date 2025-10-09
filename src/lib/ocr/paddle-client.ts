export type OCRWord = {
  text: string;
  confidence: number;
  bbox: number[];
  line_id: number;
  block_id: number;
};

export type PaddleOCRResponse = {
  engine: string;
  text: string;
  words: OCRWord[];
  orientation?: { angle: number; confidence: number };
  cached?: boolean;
  elapsed_ms?: number;
  digest?: string;
  filtered_count?: number;
  corrected_count?: number;
};

function resolveEnv(name: string, fallback?: string): string | undefined {
  const direct = process.env[name];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  const publicName = `NEXT_PUBLIC_${name}`;
  const publicValue = process.env[publicName as keyof NodeJS.ProcessEnv];
  if (typeof publicValue === "string" && publicValue.length > 0) {
    return publicValue;
  }

  return fallback;
}

export async function callPaddleOCR(
  file: Blob,
  signal?: AbortSignal,
  timeoutOverride?: number
): Promise<PaddleOCRResponse> {
  const baseUrl = resolveEnv("PADDLE_OCR_URL", "http://127.0.0.1:8080");
  if (!baseUrl) {
    throw new Error("Missing PADDLE_OCR_URL environment variable");
  }

  const timeoutMs =
    typeof timeoutOverride === "number" && Number.isFinite(timeoutOverride)
      ? timeoutOverride
      : Number(resolveEnv("OCR_TIMEOUT_MS", "10000"));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("ocr-timeout"), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      const abortListener = () => controller.abort(signal.reason);
      signal.addEventListener("abort", abortListener, { once: true });
      controller.signal.addEventListener(
        "abort",
        () => signal.removeEventListener("abort", abortListener),
        { once: true }
      );
    }
  }

  try {
    const formData = new FormData();
    formData.append("file", file);

    const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const response = await fetch(`${trimmedBase}/ocr`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`PaddleOCR request failed with status ${response.status}`);
    }

    return (await response.json()) as PaddleOCRResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}
