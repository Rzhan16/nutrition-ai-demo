import assert from "assert/strict";
import fsp from "fs/promises";
import os from "os";
import path from "path";

import { learnFromResults } from "../learn-from-results";

interface SampleWord {
  text: string;
  confidence: number;
  line_id?: number;
  block_id?: number;
}

async function createSampleResult(
  resultsDir: string,
  fileName: string,
  words: SampleWord[]
): Promise<void> {
  const payload = {
    ocr: {
      words,
    },
  };
  const targetPath = path.join(resultsDir, fileName);
  await fsp.writeFile(targetPath, JSON.stringify(payload, null, 2), "utf-8");
}

async function main(): Promise<void> {
  const tmpRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), "auto-learn-smoke-")
  );
  const batchDir = path.join(tmpRoot, "batch_ocr_out");
  const resultsDir = path.join(batchDir, "results");
  await fsp.mkdir(resultsDir, { recursive: true });

  const historyPath = path.join(batchDir, "vocab-history.json");

  const highConfidenceWords: SampleWord[] = [
    { text: "Nordic Naturals", confidence: 0.96, line_id: 0, block_id: 0 },
    { text: "Omega-3", confidence: 0.95, line_id: 1, block_id: 0 },
    { text: "Omega-3", confidence: 0.97, line_id: 2, block_id: 0 },
    { text: "Mock Capsule", confidence: 0.92, line_id: 4, block_id: 1 },
  ];
  const secondFileWords: SampleWord[] = [
    { text: "Nordic Naturals", confidence: 0.94, line_id: 0, block_id: 0 },
    { text: "Omega-3", confidence: 0.96, line_id: 1, block_id: 0 },
    { text: "Softgels", confidence: 0.91, line_id: 4, block_id: 1 },
  ];
  const thirdFileWords: SampleWord[] = [
    { text: "Herbal Balance", confidence: 0.93, line_id: 0, block_id: 0 },
    { text: "Herbal Balance", confidence: 0.92, line_id: 1, block_id: 0 },
    { text: "Vitamin Blend", confidence: 0.88, line_id: 2, block_id: 0 },
  ];

  await createSampleResult(resultsDir, "result-1.json", highConfidenceWords);
  await createSampleResult(resultsDir, "result-2.json", secondFileWords);
  await createSampleResult(resultsDir, "result-3.json", thirdFileWords);

  // Ensure files are within lookback window.
  const now = Date.now();
  for (const file of await fsp.readdir(resultsDir)) {
    const filePath = path.join(resultsDir, file);
    await fsp.utimes(filePath, now / 1000, now / 1000);
  }

  process.env.AUTOLEARN_BASE_DIR = batchDir;
  process.env.OCR_HISTORY_PATH = historyPath;
  process.env.AUTOLEARN_LOOKBACK_DAYS = "30";
  process.env.AUTOLEARN_MIN_CONF = "0.9";
  process.env.AUTOLEARN_MIN_OCCURRENCES = "2";
  process.env.AUTOLEARN_SHADOW_PREVIEW = "false";

  await learnFromResults({ baseDir: batchDir });

  const historyRawFirst = await fsp.readFile(historyPath, "utf-8");
  const historyFirst = JSON.parse(historyRawFirst);
  assert(Array.isArray(historyFirst), "History should be an array.");
  const firstLength = historyFirst.length;
  assert(
    firstLength > 0,
    "Auto-learn should append new entries on first run."
  );

  await learnFromResults({ baseDir: batchDir });
  const historyRawSecond = await fsp.readFile(historyPath, "utf-8");
  const historySecond = JSON.parse(historyRawSecond);
  assert(Array.isArray(historySecond), "History should remain an array.");
  assert.strictEqual(
    historySecond.length,
    firstLength,
    "Second run should not duplicate existing entries."
  );

  console.log("Auto-learn smoke test passed.");
}

main().catch((error) => {
  console.error("Auto-learn smoke test failed:", error);
  process.exitCode = 1;
});
