// Dev Note: Proxy to NIH DSLD label lookup. Example: GET /api/dsld/label/82118. Toggle NEXT_PUBLIC_DSLD_ENABLED='true' to surface results; set DSLD_API_KEY server-side for authenticated calls.
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NIH_LABEL_ENDPOINT = 'https://api.ods.od.nih.gov/dsld/v9/label'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 500
const SUCCESS_CACHE_HEADER = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
} as const
const ERROR_CACHE_HEADER = {
  'Cache-Control': 'no-store',
} as const

type CacheEntry = {
  expiresAt: number
  payload: unknown
}

const responseCache = new Map<string, CacheEntry>()

function getCachedPayload(key: string): unknown | null {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key)
    return null
  }
  return entry.payload
}

function setCachedPayload(key: string, payload: unknown): void {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const [oldestKey] = responseCache.keys()
    if (oldestKey) {
      responseCache.delete(oldestKey)
    }
  }
  responseCache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS })
}

function createErrorResponse(status: number, message: string, detail?: string) {
  return NextResponse.json({ error: message, status, detail }, { status, headers: ERROR_CACHE_HEADER })
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params
  const id = rawId?.trim()

  if (!id) {
    return createErrorResponse(400, 'Missing required label identifier')
  }

  const encodedId = encodeURIComponent(id)
  const apiKey = process.env.DSLD_API_KEY
  const url = new URL(`${NIH_LABEL_ENDPOINT}/${encodedId}`)
  if (apiKey) {
    url.searchParams.set('api_key', apiKey)
  }

  const cacheKey = url.toString()
  const cachedPayload = getCachedPayload(cacheKey)
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, { status: 200, headers: SUCCESS_CACHE_HEADER })
  }

  let data: unknown
  try {
    const upstreamResponse = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    if (!upstreamResponse.ok) {
      const detailText = await upstreamResponse.text().catch(() => undefined)
      return createErrorResponse(upstreamResponse.status, 'NIH DSLD label lookup failed', detailText)
    }

    data = await upstreamResponse.json()
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error'
    return createErrorResponse(502, 'Failed to reach NIH DSLD label endpoint', detail)
  }

  const payload = {
    source: 'dsld' as const,
    id,
    data,
  }

  setCachedPayload(cacheKey, payload)

  return NextResponse.json(payload, { status: 200, headers: SUCCESS_CACHE_HEADER })
}
