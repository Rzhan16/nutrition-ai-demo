// Dev Note: Proxy to NIH DSLD search-filter for enrichment. Example: GET /api/dsld/search?q=Vitamin%20C. Toggle NEXT_PUBLIC_DSLD_ENABLED='true' to surface results; set DSLD_API_KEY server-side for authenticated calls.
import { NextRequest, NextResponse } from 'next/server'
import type { DsldSearchHit } from '@/lib/dsld/types'

export const dynamic = 'force-dynamic'

const NIH_SEARCH_ENDPOINT = 'https://api.ods.od.nih.gov/dsld/v9/search-filter'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const CACHE_MAX_ENTRIES = 500
const DEFAULT_GENERIC_SIZE = 20
const DEFAULT_GENERIC_FROM = 0
const PRECISION_FETCH_SIZE = 1
const STATUS_DEFAULT = '1'
const BARCODE_PATTERN = /^[0-9\s-]+$/
const BRAND_SEEDS = [
  'sports research',
  'nature made',
  'now foods',
  'kirkland',
  'garden of life',
  'optimum nutrition',
  'vitafusion',
  'gnc',
  'vitamin shoppe',
  'pure encapsulations',
]
const SUCCESS_CACHE_HEADER = {
  'Cache-Control': 'public, max-age=300, immutable',
} as const
const ERROR_CACHE_HEADER = {
  'Cache-Control': 'no-store',
} as const

type CacheEntry = {
  expiresAt: number
  payload: unknown
}

const responseCache = new Map<string, CacheEntry>()

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

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

type PreciseDetection = {
  brand?: string
  product?: string
  quoted?: string
}

const digitsOnly = (value: string): string => value.replace(/[^0-9]/g, '')

function normalizeQuoted(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
    return `"${trimmed.replace(/"/g, '')}"`
  }
  return trimmed
}

function detectPreciseQuery(raw: string): PreciseDetection | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const digits = digitsOnly(trimmed)
  if (digits.length >= 8 && digits.length <= 14 && BARCODE_PATTERN.test(trimmed)) {
    return { quoted: normalizeQuoted(trimmed) }
  }

  const quotedMatch = trimmed.match(/"([^\"]+)"/)
  if (quotedMatch) {
    const product = quotedMatch[1].trim()
    const brand = trimmed.slice(0, quotedMatch.index).trim()
    return {
      brand: brand || undefined,
      product: product || undefined,
    }
  }

  const lower = trimmed.toLowerCase()
  const seeded = BRAND_SEEDS.find((candidate) => lower.startsWith(candidate))
  if (seeded) {
    const brand = trimmed.slice(0, seeded.length).trim()
    const product = trimmed.slice(seeded.length).trim()
    if (product) {
      return { brand, product }
    }
  }

  return null
}

const toRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined

const getStringValue = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function pickTopPreciseHit(hits: DsldSearchHit[], brand?: string, product?: string): DsldSearchHit | null {
  if (!hits.length) return null
  const targetBrand = brand?.toLowerCase()
  const targetProduct = product?.toLowerCase()

  let best: DsldSearchHit | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const hit of hits) {
    const source = toRecord(hit._source)
    const fullName = getStringValue(source?.fullName) ?? getStringValue(source?.fullNameTxt)
    const brandName = getStringValue(source?.brandName)

    let score = typeof hit._score === 'number' ? hit._score : 0

    if (targetProduct && fullName) {
      const lowerFull = fullName.toLowerCase()
      if (lowerFull.startsWith(targetProduct)) score += 80
      else if (lowerFull.includes(targetProduct)) score += 40
    }

    if (targetBrand && brandName && brandName.toLowerCase() === targetBrand) {
      score += 40
    }

    if (!best || score > bestScore) {
      bestScore = score
      best = hit
    }
  }

  return best
}

async function forwardUpstreamError(response: Response): Promise<NextResponse> {
  const body = await response.text()
  const headers = new Headers(ERROR_CACHE_HEADER)
  const contentType = response.headers.get('content-type')
  if (contentType) {
    headers.set('content-type', contentType)
  }
  return new NextResponse(body || '', { status: response.status, headers })
}

function buildResponse(payload: any, mode: 'generic' | 'precise'): NextResponse {
  const headers = new Headers({ ...SUCCESS_CACHE_HEADER, 'content-type': 'application/json', 'x-dsld-mode': mode })
  const json = JSON.stringify(payload)
  return new NextResponse(json, { status: 200, headers })
}

export async function GET(request: NextRequest) {
  const cacheKey = request.url
  const cachedPayload = getCachedPayload(cacheKey)
  if (cachedPayload) {
    const cached = cachedPayload as { body: any; mode: 'generic' | 'precise' }
    return buildResponse(cached.body, cached.mode)
  }

  const { searchParams } = new URL(request.url)
  const receivedQ = (searchParams.get('q') ?? '').trim()
  if (!receivedQ) {
    return NextResponse.json({ error: 'Missing required query parameter "q"' }, { status: 400, headers: ERROR_CACHE_HEADER })
  }

  const requestedSize = clamp(parseNumber(searchParams.get('size'), DEFAULT_GENERIC_SIZE), 1, 50)
  const requestedFrom = Math.max(parseNumber(searchParams.get('from'), DEFAULT_GENERIC_FROM), 0)
  const requestedStatus = searchParams.get('status')?.trim() || STATUS_DEFAULT
  const explicitBrand = searchParams.get('brand')?.trim() || undefined
  const explicitProduct = searchParams.get('product_name')?.trim() || undefined

  let detectedPrecise = detectPreciseQuery(receivedQ)
  if (explicitBrand || explicitProduct) {
    detectedPrecise = {
      brand: explicitBrand ?? detectedPrecise?.brand,
      product: explicitProduct ?? detectedPrecise?.product,
      quoted: detectedPrecise?.quoted,
    }
  }

  let finalMode: 'generic' | 'precise' = 'generic'
  const meta: Record<string, unknown> = {
    receivedQ,
    size: requestedSize,
    from: requestedFrom,
    status: requestedStatus,
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  const apiKey = process.env.DSLD_API_KEY
  if (apiKey) {
    headers['x-api-key'] = apiKey
  }

  const buildUrl = (params: URLSearchParams): string => {
    if (apiKey) {
      params.set('api_key', apiKey)
    }
    return `${NIH_SEARCH_ENDPOINT}?${params.toString()}`
  }

  const fetchJson = async (url: string) => {
    const upstreamResponse = await fetch(url, { method: 'GET', headers })
    if (!upstreamResponse.ok) {
      throw await forwardUpstreamError(upstreamResponse)
    }
    return upstreamResponse.json()
  }

  let payloadData: any
  let attemptedPrecise = false
  let preciseUrlUsed: string | undefined

  try {
    if (detectedPrecise) {
      attemptedPrecise = true
      const preciseParams = new URLSearchParams({ status: requestedStatus, size: String(PRECISION_FETCH_SIZE) })
      if (detectedPrecise.quoted) {
        preciseParams.set('q', detectedPrecise.quoted)
        meta.sentQ = detectedPrecise.quoted
      } else {
        const preciseBrand = detectedPrecise.brand
        const preciseProduct = detectedPrecise.product
        if (preciseBrand) preciseParams.set('brand', preciseBrand)
        if (preciseProduct) preciseParams.set('product_name', preciseProduct)
        meta.preciseBrand = preciseBrand
        meta.preciseProduct = preciseProduct
      }

      preciseParams.set('size', String(PRECISION_FETCH_SIZE))
      preciseUrlUsed = buildUrl(new URLSearchParams(preciseParams))
      const preciseData = await fetchJson(preciseUrlUsed)
      const hits = Array.isArray(preciseData?.hits) ? (preciseData.hits as DsldSearchHit[]) : []
      const bestHit = pickTopPreciseHit(hits, detectedPrecise.brand ?? explicitBrand, detectedPrecise.product ?? explicitProduct)

      if (bestHit) {
        finalMode = 'precise'
        meta.size = PRECISION_FETCH_SIZE
        payloadData = {
          ...preciseData,
          hits: [bestHit],
          total: 1,
        }
      } else {
        meta.preciseFallback = true
      }
    }

    if (!payloadData) {
      const genericParams = new URLSearchParams({
        q: receivedQ,
        size: String(DEFAULT_GENERIC_SIZE),
        from: String(requestedFrom),
        sort_by: '_score',
        sort_order: 'desc',
        status: requestedStatus,
      })
      if (explicitBrand) genericParams.set('brand', explicitBrand)
      if (explicitProduct) genericParams.set('product_name', explicitProduct)

      meta.size = DEFAULT_GENERIC_SIZE
      const genericUrl = buildUrl(genericParams)
      const genericData = await fetchJson(genericUrl)
      payloadData = genericData
      meta.sentQ = receivedQ
      if (attemptedPrecise) {
        meta.preciseBrand = meta.preciseBrand ?? detectedPrecise?.brand
        meta.preciseProduct = meta.preciseProduct ?? detectedPrecise?.product
      }
    }
  } catch (error) {
    if (error instanceof NextResponse) {
      return error
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'NIH DSLD search failed', detail: message }, { status: 502, headers: ERROR_CACHE_HEADER })
  }

  const hits = Array.isArray(payloadData?.hits) ? (payloadData.hits as DsldSearchHit[]) : []
  const totalValue = typeof payloadData?.total === 'number' ? payloadData.total : hits.length

  meta.total = totalValue
  meta.mode = finalMode
  meta.attemptedPrecise = attemptedPrecise

  console.debug('DSLD proxy search', {
    mode: finalMode,
    size: finalMode === 'precise' ? PRECISION_FETCH_SIZE : DEFAULT_GENERIC_SIZE,
    from: requestedFrom,
    attemptedPrecise,
    preciseUrl: preciseUrlUsed,
  })

  const payloadBody = {
    source: 'dsld' as const,
    mode: finalMode,
    meta,
    data: payloadData,
  }

  setCachedPayload(cacheKey, { body: payloadBody, mode: finalMode })

  return buildResponse(payloadBody, finalMode)
}
