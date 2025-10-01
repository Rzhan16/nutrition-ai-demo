/*
  Warnings:

  - A unique constraint covering the columns `[barcode]` on the table `supplements` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "supplements" ADD COLUMN "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "supplements_barcode_key" ON "supplements"("barcode");
