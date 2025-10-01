-- CreateTable
CREATE TABLE "supplements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ingredients" JSONB NOT NULL,
    "imageUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "scans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplementId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "ocrText" TEXT,
    "analysis" JSONB,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scans_supplementId_fkey" FOREIGN KEY ("supplementId") REFERENCES "supplements" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "loginCount" INTEGER NOT NULL DEFAULT 1,
    "lastLogin" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferences" JSONB
);

-- CreateIndex
CREATE UNIQUE INDEX "users_fingerprint_key" ON "users"("fingerprint");
