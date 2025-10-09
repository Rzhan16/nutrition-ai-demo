import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling, AppError, ErrorCodes } from '@/lib/error-handler'
import {
  clearCacheByHash,
  clearCacheByScanId,
  clearEntireCache,
} from '@/lib/cache/ocr-cache'

function checkAdminToken(request: NextRequest): void {
  const requiredToken = process.env.ADMIN_TOKEN ?? 'dev-admin-token'
  const provided = request.headers.get('x-admin-token')
  if (!provided || provided !== requiredToken) {
    throw new AppError('Unauthorized', 401, ErrorCodes.UNAUTHORIZED)
  }
}

export const DELETE = withErrorHandling(async (request: NextRequest): Promise<NextResponse> => {
  checkAdminToken(request)
  const { searchParams } = new URL(request.url)
  const hash = searchParams.get('hash')
  const scanId = searchParams.get('scanId')
  const all = searchParams.get('all') === 'true'

  if (!hash && !scanId && !all) {
    return NextResponse.json(
      {
        success: false,
        message: 'Provide hash, scanId, or all=true to clear cache entries',
      },
      { status: 400 }
    )
  }

  let cleared = 0
  if (all) {
    cleared += await clearEntireCache()
  } else {
    if (hash) {
      cleared += await clearCacheByHash(hash)
    }
    if (scanId) {
      cleared += await clearCacheByScanId(scanId)
    }
  }

  return NextResponse.json({
    success: true,
    cleared,
  })
})
