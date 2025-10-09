import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { loadHistory, updateHistory } from "./utils/autolearn";
import {
  digestForSample,
  normalizeForOcr,
  type PoolName,
} from "./utils/vocab";

interface OCRWord {
  text?: string;
  confidence?: number;
  line_id?: number;
  block_id?: number;
  bbox?: [number, number, number, number];
}

interface OCRResult {
  ocr?: {
    words?: OCRWord[];
  };
}

interface AggregatedToken {
  normalized: string;
  pool: PoolName;
  count: number;
  sumConfidence: number;
  samples: Set<string>;
}

const PROTECTED_LITERALS = [
  "mg",
  "mcg",
  "g",
  "iu",
  "ml",
  "l",
  "epa",
  "dha",
  "coq10",
  "k2",
  "d3",
  "b12",
  "zinc",
  "vitamin",
  "facts",
  "serving",
  "capsules",
  "softgels",
];
const PROTECTED_UNITS_RE = /^\d+(?:\.\d+)?\s*(mg|mcg|g|iu|ml|l|oz|%|mcgs?)$/i;

const DEFAULT_BASE_DIR = path.resolve(
  process.cwd(),
  "webapp/batch_ocr_out"
);

export interface LearnFromResultsOptions {
  baseDir?: string;
  now?: Date;
  shadowPreview?: boolean;
}

export async function learnFromResults(
  options: LearnFromResultsOptions = {}
): Promise<void> {
  const now = options.now ?? new Date();
  const baseDir =
    options.baseDir ??
    process.env.AUTOLEARN_BASE_DIR ??
    DEFAULT_BASE_DIR;
  const resolvedBaseDir = path.resolve(baseDir);
  const resultsDir =
    process.env.AUTOLEARN_RESULTS_DIR ??
    path.join(resolvedBaseDir, "results");
  const resolvedResultsDir = path.resolve(resultsDir);

  const minConfidence = Number(process.env.AUTOLEARN_MIN_CONF ?? "0.9");
  const minOccurrences = Math.max(
    1,
    Number(process.env.AUTOLEARN_MIN_OCCURRENCES ?? "2")
  );
  const lookbackDays = Math.max(
    1,
    Number(process.env.AUTOLEARN_LOOKBACK_DAYS ?? "7")
  );
  const shadowPreview =
    options.shadowPreview ??
    /^true$/i.test(process.env.AUTOLEARN_SHADOW_PREVIEW ?? "false");

  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
  const thresholdTime = new Date(now.getTime() - lookbackMs);

  const normalizedProtected = new Set(
    PROTECTED_LITERALS.map((literal) => normalizeForOcr(literal))
  );

  const aggregated = new Map<string, AggregatedToken>();
  const processedFiles: string[] = [];
  let earliest: Date | null = null;
  let latest: Date | null = null;

  if (!fs.existsSync(resolvedResultsDir)) {
    console.warn(
      `[AUTOLEARN] Results directory not found: ${resolvedResultsDir}`
    );
    return;
  }

  const entries = await fsp.readdir(resolvedResultsDir);
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const fullPath = path.join(resolvedResultsDir, entry);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(fullPath);
    } catch {
      continue;
    }
    if (stat.mtime < thresholdTime) {
      continue;
    }
    earliest = earliest ? new Date(Math.min(earliest.getTime(), stat.mtime.getTime())) : stat.mtime;
    latest = latest ? new Date(Math.max(latest.getTime(), stat.mtime.getTime())) : stat.mtime;

    let parsed: OCRResult;
    try {
      const raw = await fsp.readFile(fullPath, "utf-8");
      parsed = JSON.parse(raw) as OCRResult;
    } catch (error) {
      console.warn(`[AUTOLEARN] Failed to parse ${entry}: ${(error as Error).message}`);
      continue;
    }
    processedFiles.push(entry);
    const words = Array.isArray(parsed?.ocr?.words)
      ? (parsed!.ocr!.words as OCRWord[])
      : [];
    for (const word of words) {
      const rawText = word?.text;
      if (typeof rawText !== "string") continue;
      const confidence = Number(word?.confidence ?? 0);
      if (!Number.isFinite(confidence) || confidence < minConfidence) {
        continue;
      }
      if (PROTECTED_UNITS_RE.test(rawText)) continue;
      const normalized = normalizeForOcr(rawText);
      if (!normalized) continue;
      if (normalizedProtected.has(normalized)) continue;
      if (normalized.length <= 1) continue;
      const pool = inferPool(word, normalized);
      const key = `${pool}::${normalized}`;
      const record = aggregated.get(key);
      if (record) {
        record.count += 1;
        record.sumConfidence += confidence;
        record.samples.add(rawText);
      } else {
        aggregated.set(key, {
          normalized,
          pool,
          count: 1,
          sumConfidence: confidence,
          samples: new Set([rawText]),
        });
      }
    }
  }

  if (aggregated.size === 0) {
    console.log(
      `[AUTOLEARN] No qualifying tokens in the last ${lookbackDays} day(s).`
    );
    return;
  }

  const existingHistory = await loadHistory(
    process.env.OCR_HISTORY_PATH
  );
  const existingKeys = new Set(
    existingHistory.map((record) =>
      `${record.pool ?? "common"}::${normalizeForOcr(record.normalizedTo)}`
    )
  );

  const learned: AggregatedToken[] = [];
  let skippedLowOccurrence = 0;

  for (const stat of aggregated.values()) {
    if (stat.count < minOccurrences) {
      skippedLowOccurrence += 1;
      continue;
    }
    const historyKey = `${stat.pool}::${stat.normalized}`;
    if (existingKeys.has(historyKey)) {
      continue;
    }
    learned.push(stat);
    existingKeys.add(historyKey);
  }

  if (learned.length === 0) {
    console.log(
      `[AUTOLEARN] No new tokens exceeded occurrence threshold (${minOccurrences}).`
    );
  }

  if (!shadowPreview) {
    for (const token of learned) {
      const sample =
        token.samples.values().next().value ?? token.normalized;
      const averageConfidence = token.sumConfidence / token.count;
      await updateHistory({
        learnedFrom: sample,
        normalizedTo: token.normalized,
        confidence: averageConfidence,
        pool: token.pool,
        digest: digestForSample([
          token.normalized,
          token.pool,
          token.count.toString(),
        ]),
      });
    }
  }

  const rangeStart = earliest ? earliest.toISOString() : "n/a";
  const rangeEnd = latest ? latest.toISOString() : "n/a";
  console.log(
    `[AUTOLEARN] learned=${learned.length} shadow=${shadowPreview} skipped_low_occ=${skippedLowOccurrence} files=${processedFiles.length} range=${rangeStart}..${rangeEnd}`
  );
  if (shadowPreview && learned.length > 0) {
    const preview = learned
      .slice(0, 10)
      .map(
        (token) =>
          `${token.normalized} [${token.pool}] x${token.count} avg=${
            token.sumConfidence / token.count
          }`
      );
    console.log("[AUTOLEARN] Preview:", preview);
  }
}

function inferPool(word: OCRWord, normalized: string): PoolName {
  const text = word?.text ?? "";
  const hasDigits = /\d/.test(text);
  const hasUnit =
    /(mg|mcg|g|iu|ml|l|oz|\b%|\bmcgs?)/i.test(text) || /\d%/.test(text);
  const blockId = typeof word?.block_id === "number" ? word.block_id : 999;
  const lineId = typeof word?.line_id === "number" ? word.line_id : 999;
  if (hasDigits || hasUnit) {
    return "ingredient";
  }
  if (blockId <= 0 || lineId <= 1) {
    return "brand";
  }
  if (lineId <= 3) {
    return "product";
  }
  if (normalized.length <= 3) {
    return "common";
  }
  return "common";
}

if (require.main === module) {
  learnFromResults().catch((error) => {
    console.error("[AUTOLEARN] Fatal error:", error);
    process.exitCode = 1;
  });
}
