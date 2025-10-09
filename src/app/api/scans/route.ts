import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import {
  createSuccessResponse,
  withErrorHandling,
} from '@/lib/error-handler';
import {
  getRateLimitHeaders,
  RateLimitConfigs,
  withRateLimit,
} from '@/lib/rate-limiter';
import type { OCRResult, ParsedIngredient } from '@/lib/types';

export const runtime = 'nodejs';

const LOG_PREFIX = '[API/SCANS]';

const createScanSchema = z
  .object({
    imageUrl: z.string().optional().default(''),
    userId: z.string().optional(),
    ocrText: z.string().min(1, 'OCR text is required'),
    ocrConfidence: z.number().min(0).max(1).optional(),
    ocrResult: z
      .object({
        ok: z.boolean().optional(),
        text: z.string().optional(),
        confidence: z.number().optional(),
        durationMs: z.number().optional(),
        ingredients: z
          .array(
            z.object({
              name: z.string(),
              amount: z.string().optional(),
              unit: z.string().optional(),
              dailyValue: z.string().optional(),
              description: z.string().optional(),
            })
          )
          .optional(),
        servingSize: z.string().optional(),
        brand: z.string().optional(),
        productName: z.string().optional(),
        nutritionFacts: z.any().optional(),
        warnings: z.array(z.string()).optional(),
        qualityMetrics: z.any().optional(),
        diagnostics: z.any().optional(),
        barcode: z.string().optional(),
        raw: z.any().optional(),
      })
      .optional(),
  })
  .passthrough();

const historyQuerySchema = z.object({
  userId: z.string().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(value => Number.parseInt(value, 10))
    .optional(),
});

const DEFAULT_HISTORY_LIMIT = 8;

export const POST = withErrorHandling(async (request: NextRequest) => {
  const rateLimit = withRateLimit(RateLimitConfigs.GENERAL)(request);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many scan requests',
      }),
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }

  const payload = createScanSchema.parse(await request.json());
  const databaseUrl = process.env.DATABASE_URL ?? 'sqlite_default';
  const enablePersist = process.env.ENABLE_SCAN_PERSIST === 'true';

  console.log(LOG_PREFIX, 'create request received', {
    databaseUrl,
    hasText: Boolean(payload.ocrText),
    userId: payload.userId ?? null,
    enablePersist,
  });

  if (!enablePersist) {
    console.log(LOG_PREFIX, 'persistence disabled, skipping write');
    const response = createSuccessResponse(
      {
        scan: null,
        persisted: false,
      },
      'Scan persistence disabled'
    );

    Object.entries(getRateLimitHeaders(rateLimit)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  try {
    const scan = await prisma.scan.create({
      data: {
        imageUrl: payload.imageUrl ?? '',
        ocrText: payload.ocrText,
        ocrConfidence: payload.ocrConfidence ?? payload.ocrResult?.confidence,
        ocrData: payload.ocrResult ?? null,
        userId: payload.userId,
      },
    });

    console.log(LOG_PREFIX, 'create success', { scanId: scan.id });

    const response = createSuccessResponse(
      {
        scan,
        persisted: true,
      },
      'Scan saved successfully'
    );

    Object.entries(getRateLimitHeaders(rateLimit)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(LOG_PREFIX, 'create failed', {
      databaseUrl,
      error: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'DATABASE_WRITE_FAILED',
        message: 'Failed to persist scan record',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const rateLimit = withRateLimit(RateLimitConfigs.GENERAL)(request);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
      }),
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const parsed = historyQuerySchema.safeParse({
    userId: searchParams.get('userId') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        details: parsed.error.format(),
      }),
      { status: 400 }
    );
  }

  const { userId, limit } = parsed.data;
  const take = Math.min(limit ?? DEFAULT_HISTORY_LIMIT, 20);

  try {
    const scans = await prisma.scan.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        supplement: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: true,
          },
        },
      },
    });

    const data = {
      scans: scans.map(scan => ({
        ...scan,
        ingredients: extractIngredientsFromScan(scan.ocrData),
      })),
      pagination: {
        total: scans.length,
        limit: take,
        offset: 0,
        hasMore: scans.length === take,
      },
    };

    const response = createSuccessResponse(
      data,
      'Scan history retrieved successfully'
    );

    Object.entries(getRateLimitHeaders(rateLimit)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(LOG_PREFIX, 'history fetch failed', {
      databaseUrl: process.env.DATABASE_URL ?? 'sqlite_default',
      error: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'DATABASE_READ_FAILED',
        message: 'Failed to load scan history',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
});

function extractIngredientsFromScan(
  ocrData: OCRResult | null | undefined
): ParsedIngredient[] {
  if (!ocrData || !Array.isArray(ocrData.ingredients)) {
    return [];
  }
  return ocrData.ingredients.map(ingredient => ({
    name: ingredient.name,
    amount: ingredient.amount,
    unit: ingredient.unit,
    dailyValue: ingredient.dailyValue,
    description: ingredient.description,
  }));
}
