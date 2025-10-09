import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fsp from "fs/promises";
import { z } from "zod";

import {
  CURATED_DIR,
  appendImportLog,
  computeSha256,
  readPointer,
  writePointer,
  type CuratedEntry,
  type CuratedEquivalent,
} from "../../../../lib/server/curated-storage";

const entrySchema = z.object({
  pool: z.enum(["brand", "product", "ingredient", "common"]),
  value: z.string().trim().min(1),
});

const equivalentSchema = z.object({
  canonical: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
});

const versionSchema = z.object({
  version: z.string().trim().min(1),
  createdAt: z.string().optional(),
  generatedAt: z.string().optional(),
  entries: z.array(entrySchema).default([]),
  equivalents: z.array(equivalentSchema).default([]),
  counts: z
    .object({
      entries: z.number().optional(),
      equivalents: z.number().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminToken = process.env.ADMIN_TOKEN ?? "dev-admin-token";
  const providedToken = request.headers.get("x-admin-token");
  if (!providedToken || providedToken !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const versionParam = searchParams.get("version");
  if (!versionParam) {
    return NextResponse.json(
      { error: "Missing version query parameter." },
      { status: 400 }
    );
  }
  const versionFileName = versionParam.endsWith(".json")
    ? versionParam
    : `${versionParam}.json`;
  const versionPath = path.join(CURATED_DIR, versionFileName);
  let versionRaw: string;
  try {
    versionRaw = await fsp.readFile(versionPath, "utf-8");
  } catch {
    return NextResponse.json(
      { error: `Version file not found: ${versionFileName}` },
      { status: 404 }
    );
  }

  let parsedVersion;
  try {
    parsedVersion = versionSchema.parse(JSON.parse(versionRaw));
  } catch (error) {
    return NextResponse.json(
      { error: `Invalid version file: ${(error as Error).message}` },
      { status: 400 }
    );
  }

  const sha256 = computeSha256(versionRaw);
  const pointer = await readPointer();
  const publishedAt = new Date().toISOString();
  const pointerPayload = {
    version: versionFileName,
    generatedAt: publishedAt,
    entries: parsedVersion.entries as CuratedEntry[],
    equivalents: parsedVersion.equivalents as CuratedEquivalent[],
    counts: {
      entries: parsedVersion.entries.length,
      equivalents: parsedVersion.equivalents.length,
    },
    sha256,
  };

  await writePointer(pointerPayload);

  // Append a publish log entry for traceability.
  await appendImportLog({
    version: versionFileName,
    at: publishedAt,
    by: "admin-publish",
    counts: {
      entries: parsedVersion.entries.length,
      equivalents: parsedVersion.equivalents.length,
    },
    sha256,
  });

  return NextResponse.json({
    version: versionFileName,
    generatedAt: publishedAt,
    counts: pointerPayload.counts,
    previousVersion: pointer.version,
  });
}
