import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fsp from "fs/promises";

import {
  CURATED_BASE_DIR,
  readImportLog,
  readPointer,
} from "../../../../lib/server/curated-storage";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adminToken = process.env.ADMIN_TOKEN ?? "dev-admin-token";
  const providedToken = request.headers.get("x-admin-token");
  if (!providedToken || providedToken !== adminToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pointer = await readPointer();
  const logs = await readImportLog();
  const recentLogs = logs.slice(-5).reverse();
  const historyPath = path.join(CURATED_BASE_DIR, "vocab-history.json");
  let autoLearnCount = 0;
  try {
    const historyRaw = await fsp.readFile(historyPath, "utf-8");
    const history = JSON.parse(historyRaw);
    if (Array.isArray(history)) {
      autoLearnCount = history.length;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn(
        `[Curated] Failed to read vocab history: ${(error as Error).message}`
      );
    }
  }

  return NextResponse.json({
    pointer,
    recentImports: recentLogs,
    autoLearnHistoryCount: autoLearnCount,
  });
}
