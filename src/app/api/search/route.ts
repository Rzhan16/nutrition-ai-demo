import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { withErrorHandling, createSuccessResponse } from '@/lib/error-handler'
import { withRateLimit, RateLimitConfigs, getRateLimitHeaders } from '@/lib/rate-limiter'
import { searchSchema } from '@/lib/validations'
import { prisma } from '@/lib/db'

const POPULAR_SEARCHES = [
  'Vitamin D3',
  'Omega 3',
  'Magnesium',
  'Probiotics',
  'Vitamin B12',
  'Iron',
  'Calcium',
  'Zinc',
]

const STRIP_UNITS_REGEX = /\b\d+(mg|mcg|iu|g|grams?|ml|milligrams?|micrograms?|capsules?)\b/gi
const STRIP_GENERIC_PHRASES_REGEX = /dietary\s+supplement/gi
const WHITESPACE_REGEX = /\s+/g
const SUGGESTION_LIMIT = 25

interface QueryNormalization {
  raw: string
  cleaned: string
  tokens: string[]
  short: string
  clauses: NonNullable<Prisma.SupplementWhereInput['OR']>
}

interface SearchOptions {
  query: string
  page: number
  limit: number
  category?: string
  brand?: string
}

const normalizeQuery = (rawQuery: string): QueryNormalization => {
  const raw = rawQuery.trim()
  const cleaned = raw
    .replace(STRIP_UNITS_REGEX, '')
    .replace(STRIP_GENERIC_PHRASES_REGEX, '')
    .replace(WHITESPACE_REGEX, ' ')
    .trim()

  const tokens = cleaned.split(/\s+/).filter(Boolean)
  const short = tokens.slice(0, 2).join(' ') || cleaned

  const clauses: QueryNormalization['clauses'] = []

  const pushClause = (
    field: 'name' | 'brand',
    comparator: 'contains' | 'startsWith',
    value: string,
  ) => {
    if (!value) return
    const clause: Prisma.SupplementWhereInput = {
      [field]: { [comparator]: value },
    }
    clauses.push(clause)
  }

  if (short) {
    pushClause('brand', 'contains', short)
    pushClause('name', 'contains', short)
    pushClause('name', 'startsWith', short)
  }

  for (const token of tokens) {
    pushClause('name', 'contains', token)
    pushClause('brand', 'contains', token)
  }

  if (cleaned && cleaned !== short) {
    pushClause('name', 'contains', cleaned)
    pushClause('brand', 'contains', cleaned)
  }

  return { raw, cleaned, tokens, short, clauses }
}

const buildWhere = (
  normalization: QueryNormalization,
  category?: string,
  brand?: string,
): Prisma.SupplementWhereInput | undefined => {
  const where: Prisma.SupplementWhereInput = {}

  if (normalization.clauses.length > 0) {
    where.OR = normalization.clauses
  }

  if (category) {
    where.category = { contains: category }
  }

  if (brand) {
    where.brand = { contains: brand }
  }

  return Object.keys(where).length > 0 ? where : undefined
}

const toPositiveInt = (value: number, fallback: number, max: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return Math.min(Math.floor(value), max)
}

const performSearch = async (options: SearchOptions) => {
  const { query, page, limit, category, brand } = options
  const normalization = normalizeQuery(query)
  const where = buildWhere(normalization, category, brand)
  const take = toPositiveInt(limit, 10, 50)
  const pageNumber = toPositiveInt(page, 1, Number.MAX_SAFE_INTEGER)
  const skip = (pageNumber - 1) * take

  const [supplements, total, categoryRows, brandRows] = await Promise.all([
    prisma.supplement.findMany({
      where,
      orderBy: [
        { verified: 'desc' },
        { createdAt: 'desc' },
      ],
      take,
      skip,
    }),
    prisma.supplement.count({ where }),
    prisma.supplement.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
      take: SUGGESTION_LIMIT,
    }),
    prisma.supplement.findMany({
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
      take: SUGGESTION_LIMIT,
    }),
  ])

  console.log('[SEARCH]', {
    raw: normalization.raw,
    cleaned: normalization.cleaned,
    tokens: normalization.tokens,
    resultCount: supplements.length,
  })

  const suggestions = {
    categories: categoryRows
      .map(entry => entry.category)
      .filter((value): value is string => Boolean(value)),
    brands: brandRows
      .map(entry => entry.brand)
      .filter((value): value is string => Boolean(value)),
    popularSearches: POPULAR_SEARCHES,
  }

  const pagination = {
    total,
    page: pageNumber,
    limit: take,
    totalPages: take > 0 ? Math.ceil(total / take) : 0,
    hasNext: pageNumber * take < total,
    hasPrev: pageNumber > 1,
  }

  const searchMeta = {
    query: normalization.raw,
    normalized: normalization.cleaned,
    tokens: normalization.tokens,
    resultCount: supplements.length,
    filters: {
      category,
      brand,
    },
  }

  return {
    supplements,
    pagination,
    suggestions,
    searchMeta,
  }
}

const attachRateLimitHeaders = (response: NextResponse, rateLimitResult: { remaining: number; resetTime: number }) => {
  Object.entries(getRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  const rateLimitResult = withRateLimit(RateLimitConfigs.SEARCH)(request)

  const { searchParams } = new URL(request.url)
  const rawQuery = (searchParams.get('q') || '').trim()
  const category = searchParams.get('category') || undefined
  const brand = searchParams.get('brand') || undefined
  const page = Number(searchParams.get('page') || '1')
  const limit = Number(searchParams.get('limit') || '10')

  const validated = searchSchema.parse({
    query: rawQuery,
    category,
    brand,
    page,
    limit,
  })

  const data = await performSearch({
    query: validated.query,
    page: validated.page,
    limit: validated.limit,
    category: validated.category,
    brand: validated.brand,
  })

  const response = createSuccessResponse(data)
  attachRateLimitHeaders(response, rateLimitResult)
  return response
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const rateLimitResult = withRateLimit(RateLimitConfigs.SEARCH)(request)

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const filters = (payload?.filters ?? {}) as Record<string, unknown>

  const resolveFilterValue = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      return value
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0]
    }
    return undefined
  }

  const rawQuery =
    typeof payload.query === 'string'
      ? payload.query.trim()
      : typeof (payload as any).q === 'string'
      ? ((payload as any).q as string).trim()
      : ''

  const category = resolveFilterValue(payload.category ?? filters.category)
  const brand = resolveFilterValue(payload.brand ?? filters.brand)

  const pageCandidate =
    typeof payload.page === 'number'
      ? payload.page
      : typeof payload.page === 'string'
      ? Number(payload.page)
      : undefined

  const limitCandidate =
    typeof payload.limit === 'number'
      ? payload.limit
      : typeof payload.limit === 'string'
      ? Number(payload.limit)
      : undefined

  const validated = searchSchema.parse({
    query: rawQuery,
    category,
    brand,
    page: pageCandidate ?? 1,
    limit: limitCandidate ?? 10,
  })

  const data = await performSearch({
    query: validated.query,
    page: validated.page,
    limit: validated.limit,
    category: validated.category,
    brand: validated.brand,
  })

  const response = createSuccessResponse(data)
  attachRateLimitHeaders(response, rateLimitResult)
  return response
})
