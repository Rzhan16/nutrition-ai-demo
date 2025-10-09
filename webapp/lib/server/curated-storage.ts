import crypto from "crypto";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

export type CuratedPool = "brand" | "product" | "ingredient" | "common";

export interface CuratedEntry {
  pool: CuratedPool;
  value: string;
}

export interface CuratedEquivalent {
  canonical: string;
  aliases: string[];
}

export interface CuratedPointer {
  version: string | null;
  generatedAt: string | null;
  entries: CuratedEntry[];
  equivalents: CuratedEquivalent[];
  counts?: {
    entries?: number;
    equivalents?: number;
  };
  sha256?: string | null;
}

export interface ImportLogEntry {
  version: string;
  at: string;
  by: string;
  counts: {
    entries: number;
    equivalents: number;
  };
  sha256: string;
}

export const CURATED_BASE_DIR = path.resolve(
  process.cwd(),
  "webapp/batch_ocr_out"
);
export const CURATED_DIR = path.join(CURATED_BASE_DIR, "curated");
export const CURATED_POINTER_PATH = path.join(
  CURATED_BASE_DIR,
  "curated-latest.json"
);
export const CURATED_LOG_PATH = path.join(
  CURATED_BASE_DIR,
  "curated-import-log.json"
);

export async function ensureDir(dirPath: string): Promise<void> {
  await fsp.mkdir(dirPath, { recursive: true });
}

export async function readPointer(): Promise<CuratedPointer> {
  try {
    const raw = await fsp.readFile(CURATED_POINTER_PATH, "utf-8");
    return JSON.parse(raw) as CuratedPointer;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn(
        `[Curated] Failed to read pointer: ${(error as Error).message}`
      );
    }
    return {
      version: null,
      generatedAt: null,
      entries: [],
      equivalents: [],
    };
  }
}

export async function writePointer(data: CuratedPointer): Promise<void> {
  await ensureDir(path.dirname(CURATED_POINTER_PATH));
  await atomicWrite(
    CURATED_POINTER_PATH,
    JSON.stringify(data, null, 2)
  );
}

export async function readImportLog(): Promise<ImportLogEntry[]> {
  try {
    const raw = await fsp.readFile(CURATED_LOG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ImportLogEntry[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn(
        `[Curated] Failed to read import log: ${(error as Error).message}`
      );
    }
    return [];
  }
}

export async function appendImportLog(entry: ImportLogEntry): Promise<void> {
  const log = await readImportLog();
  log.push(entry);
  await ensureDir(path.dirname(CURATED_LOG_PATH));
  await atomicWrite(CURATED_LOG_PATH, JSON.stringify(log, null, 2));
}

export function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function atomicWrite(
  filePath: string,
  content: string
): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = path.join(
    dir,
    `${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`
  );
  await fsp.writeFile(tempPath, content, "utf-8");
  await fsp.rename(tempPath, filePath);
}

export function fileExistsSync(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}
