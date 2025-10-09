import fs from "fs";
import fsp from "fs/promises";
import path from "path";

export interface HistoryRecord {
  learnedFrom: string;
  normalizedTo: string;
  confidence: number;
  pool?: string;
  digest?: string;
  timestamp: string;
}

export interface UpdateHistoryParams {
  learnedFrom: string;
  normalizedTo: string;
  confidence: number;
  pool?: string;
  digest?: string;
  historyPath?: string;
}

const DEFAULT_HISTORY_PATH = path.resolve(
  process.cwd(),
  "webapp/batch_ocr_out/vocab-history.json"
);
const CAPACITY = 5000;

function getHistoryPath(customPath?: string): string {
  const envPath = process.env.OCR_HISTORY_PATH;
  const provided = customPath?.trim();
  return path.resolve(
    process.cwd(),
    provided || envPath || DEFAULT_HISTORY_PATH
  );
}

function dedupeRecords(records: HistoryRecord[]): HistoryRecord[] {
  const seen = new Map<string, HistoryRecord>();
  for (const record of records) {
    if (!record?.normalizedTo || !record?.learnedFrom) continue;
    const key = `${record.normalizedTo}::${record.learnedFrom}`;
    seen.set(key, record);
  }
  return Array.from(seen.values());
}

function clampSize(records: HistoryRecord[]): HistoryRecord[] {
  if (records.length <= CAPACITY) return records;
  const sorted = [...records].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );
  return sorted.slice(sorted.length - CAPACITY);
}

export async function loadHistory(pathOverride?: string): Promise<HistoryRecord[]> {
  const historyPath = getHistoryPath(pathOverride);
  try {
    const raw = await fsp.readFile(historyPath, "utf-8");
    const parsed = JSON.parse(raw) as HistoryRecord[];
    if (!Array.isArray(parsed)) return [];
    const sanitized = parsed
      .filter(
        (entry): entry is HistoryRecord =>
          !!entry &&
          typeof entry.learnedFrom === "string" &&
          typeof entry.normalizedTo === "string" &&
          typeof entry.confidence === "number"
      )
      .map((entry) => ({
        learnedFrom: entry.learnedFrom,
        normalizedTo: entry.normalizedTo,
        confidence: entry.confidence,
        pool: entry.pool,
        digest: entry.digest,
        timestamp: entry.timestamp ?? new Date().toISOString(),
      }));
    return clampSize(dedupeRecords(sanitized));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return [];
    }
    console.warn(
      `[OCR][autolearn] Failed to load history (${historyPath}): ${
        (error as Error)?.message ?? error
      }`
    );
    return [];
  }
}

async function writeHistoryAtomic(
  historyPath: string,
  records: HistoryRecord[]
): Promise<void> {
  const dir = path.dirname(historyPath);
  await fsp.mkdir(dir, { recursive: true });
  const payload = JSON.stringify(records, null, 2);
  const tmpPath = path.join(
    dir,
    `${path.basename(historyPath)}.tmp-${process.pid}-${Date.now()}`
  );
  await fsp.writeFile(tmpPath, payload, "utf-8");
  await fsp.rename(tmpPath, historyPath);
}

export async function updateHistory(params: UpdateHistoryParams): Promise<void> {
  const { learnedFrom, normalizedTo, confidence, pool, digest, historyPath } =
    params;
  if (!learnedFrom || !normalizedTo || !Number.isFinite(confidence)) {
    return;
  }
  const pathToUse = getHistoryPath(historyPath);
  const record: HistoryRecord = {
    learnedFrom,
    normalizedTo,
    confidence,
    pool,
    digest,
    timestamp: new Date().toISOString(),
  };
  const existing = await loadHistory(pathToUse);
  const combined = clampSize(dedupeRecords([...existing, record]));
  try {
    await writeHistoryAtomic(pathToUse, combined);
  } catch (error: unknown) {
    console.warn(
      `[OCR][autolearn] Failed to write history (${pathToUse}): ${
        (error as Error)?.message ?? error
      }`
    );
    try {
      if (fs.existsSync(pathToUse)) {
        await writeHistoryAtomic(pathToUse, existing);
      }
    } catch {
      /* swallow secondary failure */
    }
  }
}
