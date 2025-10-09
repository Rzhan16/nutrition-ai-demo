import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fsp from "fs/promises";
import { z } from "zod";

import {
  CURATED_DIR,
  appendImportLog,
  atomicWrite,
  computeSha256,
  ensureDir,
  type CuratedEntry,
  type CuratedEquivalent,
  type ImportLogEntry,
} from "../../../../lib/server/curated-storage";

const ALLOWED_POOLS = ["brand", "product", "ingredient", "common"] as const;

const entrySchema = z.object({
  pool: z
    .enum(ALLOWED_POOLS)
    .default("common"),
  value: z
    .string()
    .trim()
    .min(1),
});

const equivalentSchema = z.object({
  canonical: z
    .string()
    .trim()
    .min(1),
  aliases: z
    .array(z.string().trim().min(1))
    .default([]),
});

const jsonSchema = z.object({
  entries: z.array(entrySchema).optional(),
  equivalents: z.array(equivalentSchema).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminToken = process.env.ADMIN_TOKEN ?? "dev-admin-token";
  const providedToken = request.headers.get("x-admin-token");
  if (!providedToken || providedToken !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedInput: { entries: CuratedEntry[]; equivalents: CuratedEquivalent[] };
  try {
    parsedInput = await parseInput(request);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }

  const entries = dedupeEntries(parsedInput.entries);
  const equivalents = dedupeEquivalents(parsedInput.equivalents);

  if (!entries.length && !equivalents.length) {
    return NextResponse.json(
      { error: "No valid entries or equivalents provided." },
      { status: 400 }
    );
  }

  await ensureDir(CURATED_DIR);
  const now = new Date();
  let versionBase = buildVersionLabel(now);
  let versionFileName = `${versionBase}.json`;
  let versionPath = path.join(CURATED_DIR, versionFileName);
  let attempt = 0;
  while (attempt < 5) {
    try {
      await fsp.access(versionPath);
      attempt += 1;
      versionBase = `${buildVersionLabel(now)}-${attempt}`;
      versionFileName = `${versionBase}.json`;
      versionPath = path.join(CURATED_DIR, versionFileName);
    } catch {
      break;
    }
  }

  const versionPayload = {
    version: versionFileName,
    createdAt: now.toISOString(),
    entries,
    equivalents,
    counts: {
      entries: entries.length,
      equivalents: equivalents.length,
    },
  };
  const serialized = JSON.stringify(versionPayload, null, 2);
  const sha256 = computeSha256(serialized);
  await atomicWrite(versionPath, serialized);

  const logEntry: ImportLogEntry = {
    version: versionFileName,
    at: now.toISOString(),
    by: "admin",
    counts: {
      entries: entries.length,
      equivalents: equivalents.length,
    },
    sha256,
  };
  await appendImportLog(logEntry);

  return NextResponse.json({
    version: versionFileName,
    previewCounts: {
      entries: entries.length,
      equivalents: equivalents.length,
    },
    sha256,
    note: "Use /api/admin/vocab/publish?version=...",
  });
}

async function parseInput(
  request: NextRequest
): Promise<{ entries: CuratedEntry[]; equivalents: CuratedEquivalent[] }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Missing file field in multipart payload.");
    }
    const text = await file.text();
    return interpretContent(text, file.type || "");
  }

  const rawBody = await request.text();
  return interpretContent(rawBody, contentType);
}

function interpretContent(
  payload: string,
  contentType: string
): { entries: CuratedEntry[]; equivalents: CuratedEquivalent[] } {
  const trimmed = payload.trim();
  if (!trimmed) {
    throw new Error("Empty payload.");
  }
  const isLikelyJson =
    contentType.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (isLikelyJson) {
    const parsed = jsonSchema.parse(JSON.parse(trimmed));
    return {
      entries: (parsed.entries ?? []).map(({ pool, value }) => ({
        pool,
        value: sanitizeValue(value),
      })),
      equivalents: (parsed.equivalents ?? []).map((eq) => ({
        canonical: sanitizeValue(eq.canonical),
        aliases: Array.from(
          new Set(eq.aliases.map((alias) => sanitizeValue(alias)))
        ).filter(Boolean),
      })),
    };
  }

  return parseCsv(trimmed);
}

function parseCsv(text: string): {
  entries: CuratedEntry[];
  equivalents: CuratedEquivalent[];
} {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { entries: [], equivalents: [] };
  }
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  const poolIdx = headers.indexOf("pool");
  const valueIdx = headers.indexOf("value");
  const aliasOfIdx = headers.indexOf("alias_of");

  if (valueIdx === -1) {
    throw new Error('CSV must include a "value" column.');
  }

  const entryBuffer: CuratedEntry[] = [];
  const equivalentMap = new Map<string, { canonical: string; aliases: Set<string> }>();

  for (const row of rows) {
    const columns = row.split(",").map((col) => col.trim());
    const value = sanitizeValue(columns[valueIdx] ?? "");
    if (!value) continue;
    const pool =
      poolIdx >= 0 ? sanitizePool(columns[poolIdx]) : ("common" as CuratedPool);
    const aliasOf =
      aliasOfIdx >= 0 ? sanitizeValue(columns[aliasOfIdx] ?? "") : "";

    if (aliasOf) {
      const canonicalNorm = aliasOf.toLowerCase();
      const record = equivalentMap.get(canonicalNorm) ?? {
        canonical: aliasOf,
        aliases: new Set<string>(),
      };
      record.aliases.add(value);
      equivalentMap.set(canonicalNorm, record);
    } else {
      entryBuffer.push({ pool, value });
    }
  }

  const equivalents: CuratedEquivalent[] = Array.from(
    equivalentMap.values()
  ).map((entry) => ({
    canonical: entry.canonical,
    aliases: Array.from(entry.aliases),
  }));

  return {
    entries: entryBuffer,
    equivalents,
  };
}

function sanitizeValue(value: string): string {
  return value.trim();
}

type CuratedPool = (typeof ALLOWED_POOLS)[number];

function sanitizePool(pool?: string): CuratedPool {
  const normalized = (pool ?? "").toLowerCase();
  return ALLOWED_POOLS.includes(normalized as CuratedPool)
    ? (normalized as CuratedPool)
    : "common";
}

function dedupeEntries(entries: CuratedEntry[]): CuratedEntry[] {
  const seen = new Set<string>();
  const result: CuratedEntry[] = [];
  for (const entry of entries) {
    const key = `${entry.pool}::${entry.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function dedupeEquivalents(
  equivalents: CuratedEquivalent[]
): CuratedEquivalent[] {
  const map = new Map<string, { canonical: string; aliases: Set<string> }>();
  for (const eq of equivalents) {
    const canonical = sanitizeValue(eq.canonical);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    const existing = map.get(key) ?? { canonical, aliases: new Set<string>() };
    for (const alias of eq.aliases) {
      const trimmed = sanitizeValue(alias);
      if (!trimmed) continue;
      if (trimmed.toLowerCase() === key) continue;
      existing.aliases.add(trimmed);
    }
    map.set(key, existing);
  }
  return Array.from(map.values()).map((entry) => ({
    canonical: entry.canonical,
    aliases: Array.from(entry.aliases),
  }));
}

function buildVersionLabel(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  const ss = `${date.getSeconds()}`.padStart(2, "0");
  return `curated-${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}
