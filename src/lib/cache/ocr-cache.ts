import { createHash } from 'crypto';
import { prisma } from '@/lib/db';

const DAY_MS = 24 * 60 * 60 * 1000;

const TTL_DAYS = Number(process.env.OCR_CACHE_TTL_DAYS ?? '7');
const MAX_ENTRIES = Number(process.env.OCR_CACHE_MAX_ENTRIES ?? '1000');

const TTL_MS = Math.max(1, TTL_DAYS) * DAY_MS;

export interface CacheKeyInput {
  text?: string | null;
  imageUrl?: string | null;
  barcode?: string | null;
}

export function computeCacheKey(input: CacheKeyInput): string | null {
  const hasher = createHash('sha256');
  if (input.text && input.text.trim().length > 0) {
    hasher.update(input.text.trim());
    return `text:${hasher.digest('hex')}`;
  }
  if (input.imageUrl && input.imageUrl.trim().length > 0) {
    const imageHash = createHash('sha256').update(input.imageUrl.trim()).digest('hex');
    return `img:${imageHash}`;
  }
  if (input.barcode && input.barcode.trim().length > 0) {
    return `barcode:${input.barcode.trim()}`;
  }
  return null;
}

export async function pruneExpiredCache(): Promise<void> {
  const now = new Date();
  try {
    await prisma.ocrCacheEntry.deleteMany({ where: { expiresAt: { lte: now } } });
  } catch (error) {
    console.warn('Failed to prune expired OCR cache entries:', error);
  }

  try {
    const total = await prisma.ocrCacheEntry.count();
    if (total <= MAX_ENTRIES) {
      return;
    }
    const toRemove = total - MAX_ENTRIES;
    const staleEntries = await prisma.ocrCacheEntry.findMany({
      orderBy: { lastAccessedAt: 'asc' },
      take: toRemove,
      select: { id: true },
    });
    if (staleEntries.length) {
      await prisma.ocrCacheEntry.deleteMany({
        where: { id: { in: staleEntries.map((entry) => entry.id) } },
      });
    }
  } catch (error) {
    console.warn('Failed to enforce OCR cache size limits:', error);
  }
}

export async function getCachedAnalysis(hash: string) {
  if (!hash) return null;
  await pruneExpiredCache();
  try {
    const entry = await prisma.ocrCacheEntry.findUnique({
      where: { hash },
      include: { scan: true },
    });
    if (!entry || !entry.scan || !entry.scan.analysis) {
      return null;
    }
    if (entry.expiresAt <= new Date()) {
      await prisma.ocrCacheEntry.delete({ where: { id: entry.id } }).catch(() => undefined);
      return null;
    }
    await prisma.ocrCacheEntry.update({
      where: { id: entry.id },
      data: { lastAccessedAt: new Date() },
    }).catch(() => undefined);
    return entry;
  } catch (error) {
    console.warn('Failed to read OCR cache entry:', error);
    return null;
  }
}

export async function upsertCacheEntry(params: { hash: string; scanId: string; userId?: string | null }) {
  const { hash, scanId, userId } = params;
  if (!hash) return;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);
  try {
    await prisma.ocrCacheEntry.upsert({
      where: { hash },
      update: {
        scanId,
        userId,
        lastAccessedAt: now,
        expiresAt,
      },
      create: {
        hash,
        scanId,
        userId,
        expiresAt,
      },
    });
  } catch (error) {
    console.warn('Failed to upsert OCR cache entry:', error);
  }
  await pruneExpiredCache();
}

export async function clearCacheByHash(hash: string): Promise<number> {
  try {
    const result = await prisma.ocrCacheEntry.deleteMany({ where: { hash } });
    return result.count ?? 0;
  } catch (error) {
    console.warn('Failed to clear OCR cache by hash:', error);
    return 0;
  }
}

export async function clearCacheByScanId(scanId: string): Promise<number> {
  try {
    const result = await prisma.ocrCacheEntry.deleteMany({ where: { scanId } });
    return result.count ?? 0;
  } catch (error) {
    console.warn('Failed to clear OCR cache by scan id:', error);
    return 0;
  }
}

export async function clearEntireCache(): Promise<number> {
  try {
    const result = await prisma.ocrCacheEntry.deleteMany();
    return result.count ?? 0;
  } catch (error) {
    console.warn('Failed to clear OCR cache:', error);
    return 0;
  }
}
