-- AlterTable
ALTER TABLE "scans" ADD COLUMN "ocrConfidence" REAL;
ALTER TABLE "scans" ADD COLUMN "ocrData" JSONB;

-- CreateTable
CREATE TABLE "ocr_cache_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hash" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "ocr_cache_entries_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ocr_cache_entries_hash_key" ON "ocr_cache_entries"("hash");
