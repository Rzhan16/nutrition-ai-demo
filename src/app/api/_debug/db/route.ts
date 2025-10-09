import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const LOG_PREFIX = '[API/DEBUG/DB]';

export async function GET(): Promise<NextResponse> {
  const databaseUrl = process.env.DATABASE_URL ?? 'sqlite_default';
  try {
    const [supplementCount, scanCount] = await Promise.all([
      prisma.supplement.count(),
      prisma.scan.count(),
    ]);

    console.log(LOG_PREFIX, 'counts fetched', {
      databaseUrl,
      supplementCount,
      scanCount,
    });

    return NextResponse.json({
      success: true,
      data: {
        databaseUrl,
        supplementCount,
        scanCount,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(LOG_PREFIX, 'count fetch failed', {
      databaseUrl,
      error: errorMessage,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'DATABASE_COUNT_FAILED',
        message: 'Failed to read table counts',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
