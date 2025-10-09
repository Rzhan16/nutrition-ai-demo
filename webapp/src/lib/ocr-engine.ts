// 🚀 PaddleOCR 专用前端调用逻辑（无 Tesseract 回退）

import { callPaddleOCR, type PaddleOCRResp } from "./ocr/paddle-client";

type Diagnostics = {
  elapsedMs?: number;
  cached?: boolean;
  fallback?: boolean;
  filteredCount?: number;
  digest?: string;
  correctedCount?: number;
};

export type OcrEngineResult = {
  text: string;
  words: PaddleOCRResp["words"];
  engine: "paddle";
  diagnostics: Diagnostics;
};

// 主函数：统一 OCR 调用入口
export async function runOcr(file: Blob): Promise<OcrEngineResult> {
  // 🧭 检测环境变量
  const engine =
    process.env.OCR_ENGINE ??
    process.env.NEXT_PUBLIC_OCR_ENGINE ??
    "paddle";

  const paddleUrl =
    process.env.PADDLE_OCR_URL ??
    process.env.NEXT_PUBLIC_PADDLE_OCR_URL ??
    "http://127.0.0.1:8080";

  console.log("[OCR Engine] Detected engine =", engine);
  console.log("[OCR Engine] Paddle URL =", paddleUrl);

  // ✅ 永远使用 PaddleOCR
  if (engine !== "paddle") {
    console.warn(
      `[OCR Engine] Forcing PaddleOCR mode (current engine=${engine}).`
    );
  }

  try {
    console.log("[OCR Engine] Calling PaddleOCR...");
    const result = await callPaddleOCR(file);
    console.log("[OCR Engine] PaddleOCR result received ✅", result);

    return {
      text: result.text || "",
      words: result.words || [],
      engine: "paddle",
      diagnostics: {
        elapsedMs: result.elapsed_ms,
        cached: result.cached,
        filteredCount: result.filtered_count,
        digest: result.digest,
        correctedCount: result.corrected_count,
      },
    };
  } catch (error: unknown) {
    // 🧱 Paddle 调用失败时的错误输出
    if (error instanceof Error) {
      console.error("[OCR Engine] PaddleOCR failed ❌", error.message);
      throw new Error(
        `PaddleOCR request failed: ${error.message}. Please check if the OCR server (port 8080) is running.`
      );
    } else {
      console.error("[OCR Engine] PaddleOCR failed ❌", error);
      throw new Error("Unknown error calling PaddleOCR service.");
    }
  }
}
