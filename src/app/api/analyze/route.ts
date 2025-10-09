import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Prisma } from '@prisma/client'
import { createSuccessResponse, withErrorHandling } from '@/lib/error-handler'
import { withRateLimit, RateLimitConfigs, getRateLimitHeaders } from '@/lib/rate-limiter'
import { prisma } from '@/lib/db'

type BrandEquivalentEntry = {
  canonical: string
  aliases: string[]
}

type RawIngredient = {
  name?: string
  amount?: string
  unit?: string
  dailyValue?: string | number
}

const STRIP_UNITS_REGEX = /\b\d+(mg|mcg|iu|g|grams?|ml|milligrams?|micrograms?|capsules?)\b/gi
const STRIP_GENERIC_PHRASES_REGEX = /dietary\s+supplement/gi
const WHITESPACE_REGEX = /\s+/g
const BRAND_SANITIZE_REGEX = /[^a-z0-9 ]/g
const DOUBLE_SPACE_REGEX = /\s{2,}/g
const MAX_SEARCH_RESULTS = 8

const BRAND_EQUIVALENTS_PATH = path.join(
  process.cwd(),
  'webapp',
  'scripts',
  'data',
  'equivalents.json',
)

const BUILT_IN_BRAND_EQUIVALENTS: BrandEquivalentEntry[] = [
  {
    canonical: 'Sports Research',
    aliases: ['sports', 'sports research', 'sportsresearch', 'sports-research'],
  },
  {
    canonical: 'Pure Encapsulations',
    aliases: ['pure', 'encapsulations', 'pure encapsulation'],
  },
  {
    canonical: 'Thorne',
    aliases: ['thorne research', 'thorne®'],
  },
  {
    canonical: 'NOW Foods',
    aliases: ['now', 'nowfood', 'now foods'],
  },
]

interface QueryNormalization {
  raw: string
  cleaned: string
  tokens: string[]
  short: string
  clauses: NonNullable<Prisma.SupplementWhereInput['OR']>
}

interface SearchOutcome {
  normalization: QueryNormalization
  supplements: Awaited<ReturnType<typeof prisma.supplement.findMany>>
}

let cachedBrandAliasMap: Map<string, string> | null = null

const sanitizeForMatching = (value: string): string =>
  value.toLowerCase().replace(BRAND_SANITIZE_REGEX, ' ').replace(DOUBLE_SPACE_REGEX, ' ').trim()

const loadBrandAliasMap = (): Map<string, string> => {
  if (cachedBrandAliasMap) {
    return cachedBrandAliasMap
  }

  const entries: BrandEquivalentEntry[] = [...BUILT_IN_BRAND_EQUIVALENTS]

  try {
    if (fs.existsSync(BRAND_EQUIVALENTS_PATH)) {
      const raw = fs.readFileSync(BRAND_EQUIVALENTS_PATH, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        parsed.forEach(entry => {
          if (
            entry &&
            typeof entry.canonical === 'string' &&
            Array.isArray(entry.aliases)
          ) {
            entries.push({
              canonical: entry.canonical,
              aliases: entry.aliases.filter((alias: unknown): alias is string => typeof alias === 'string'),
            })
          }
        })
      }
    }
  } catch (error) {
    console.warn('[ANALYZE] Failed to load equivalents.json:', error)
  }

  const map = new Map<string, string>()

  const register = (canonical: string, alias: string) => {
    const normalizedAlias = sanitizeForMatching(alias)
    if (normalizedAlias) {
      map.set(normalizedAlias, canonical)
    }
  }

  entries.forEach(entry => {
    if (!entry.canonical) {
      return
    }
    register(entry.canonical, entry.canonical)
    entry.aliases.forEach(alias => register(entry.canonical, alias))
  })

  cachedBrandAliasMap = map
  return map
}

const normalizeBrandName = (brand?: string): string | undefined => {
  if (!brand || typeof brand !== 'string') {
    return undefined
  }

  const trimmed = brand.trim()
  if (!trimmed) {
    return undefined
  }

  const aliasMap = loadBrandAliasMap()
  const sanitized = sanitizeForMatching(trimmed)
  if (!sanitized) {
    return undefined
  }

  const direct = aliasMap.get(sanitized)
  if (direct) {
    return direct
  }

  for (const [alias, canonical] of aliasMap.entries()) {
    if (sanitized.includes(alias)) {
      return canonical
    }
  }

  if (sanitized.includes('sports')) return 'Sports Research'
  if (sanitized.includes('pure')) return 'Pure Encapsulations'
  if (sanitized.includes('thorne')) return 'Thorne'
  if (sanitized.includes('now')) return 'NOW Foods'

  return trimmed
}

const detectBrandFromText = (text: string): string | undefined => {
  if (!text) return undefined
  const aliasMap = loadBrandAliasMap()
  const sanitizedText = sanitizeForMatching(text)
  if (!sanitizedText) return undefined

  for (const [alias, canonical] of aliasMap.entries()) {
    const pattern = alias.includes(' ')
      ? alias
      : ` ${alias} `
    if (
      sanitizedText === alias ||
      sanitizedText.startsWith(`${alias} `) ||
      sanitizedText.endsWith(` ${alias}`) ||
      sanitizedText.includes(pattern)
    ) {
      return canonical
    }
  }

  if (sanitizedText.includes('sports')) return 'Sports Research'
  if (sanitizedText.includes('pure')) return 'Pure Encapsulations'
  if (sanitizedText.includes('thorne')) return 'Thorne'
  if (sanitizedText.includes('now')) return 'NOW Foods'

  return undefined
}

const cleanText = (value: string): string => {
  if (!value) return ''
  const lines = value.replace(/\r\n/g, '\n').split('\n')
  return lines
    .map(line =>
      line
        .replace(STRIP_UNITS_REGEX, ' ')
        .replace(STRIP_GENERIC_PHRASES_REGEX, ' ')
        .replace(WHITESPACE_REGEX, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
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

const buildWhereForAnalyze = (
  normalization: QueryNormalization,
  brand?: string,
): Prisma.SupplementWhereInput | undefined => {
  const where: Prisma.SupplementWhereInput = {}

  if (normalization.clauses.length > 0) {
    where.OR = normalization.clauses
  }

  if (brand) {
    where.brand = { contains: brand }
  }

  return Object.keys(where).length > 0 ? where : undefined
}

const runDatabaseSearch = async (query: string, brand?: string): Promise<SearchOutcome> => {
  const normalization = normalizeQuery(query)
  const where = buildWhereForAnalyze(normalization, brand)

  if (!where) {
    return { normalization, supplements: [] }
  }

  const find = (input: Prisma.SupplementWhereInput) =>
    prisma.supplement.findMany({
      where: input,
      orderBy: [
        { verified: 'desc' },
        { createdAt: 'desc' },
      ],
      take: MAX_SEARCH_RESULTS,
    })

  let supplements = await find(where)

  if (supplements.length === 0 && brand) {
    const fallbackWhere = buildWhereForAnalyze(normalization, undefined)
    if (fallbackWhere) {
      supplements = await find(fallbackWhere)
    }
  }

  return { normalization, supplements }
}

const parseIngredients = (value: unknown): Array<{
  name: string
  amount: string
  unit: string
  dailyValue?: number
}> => {
  let raw: unknown = value
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value)
    } catch {
      raw = []
    }
  }

  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const ingredient = item as RawIngredient
      const name = typeof ingredient.name === 'string' ? ingredient.name : ''
      if (!name) return null

      const amount = typeof ingredient.amount === 'string' ? ingredient.amount : ''
      const unit = typeof ingredient.unit === 'string' ? ingredient.unit : ''
      const rawDailyValue = ingredient.dailyValue

      let dailyValue: number | undefined
      if (typeof rawDailyValue === 'number') {
        dailyValue = rawDailyValue
      } else if (typeof rawDailyValue === 'string') {
        const numeric = Number.parseFloat(rawDailyValue.replace('%', '').trim())
        if (!Number.isNaN(numeric)) {
          dailyValue = numeric
        }
      }

      return {
        name,
        amount,
        unit,
        dailyValue,
      }
    })
    .filter((value): value is {
      name: string
      amount: string
      unit: string
      dailyValue?: number
    } => Boolean(value))
}

const attachRateLimitHeaders = (
  response: NextResponse,
  rateLimitResult: { remaining: number; resetTime: number },
) => {
  Object.entries(getRateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
}

const buildSearchQuery = (text: string, brand?: string) => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const tokens = text.split(/\s+/).filter(Boolean)
  const primaryTokens = tokens.slice(0, 8)
  const queryParts = new Set<string>()

  if (brand) queryParts.add(brand)
  if (lines[0]) queryParts.add(lines[0])
  if (lines[1]) queryParts.add(lines[1])
  if (primaryTokens.length > 0) {
    queryParts.add(primaryTokens.join(' '))
  }

  const query =
    Array.from(queryParts)
      .join(' ')
      .trim() ||
    brand ||
    primaryTokens.slice(0, 3).join(' ')

  return {
    query: query.trim(),
    lines,
    tokens: primaryTokens,
  }
}

const extractTextPayload = (body: Record<string, unknown>): string => {
  if (typeof body.text === 'string') {
    return body.text
  }
  if (typeof body.ocrText === 'string') {
    return body.ocrText
  }
  const ocrResult = body.ocrResult as Record<string, unknown> | undefined
  if (ocrResult && typeof ocrResult.text === 'string') {
    return ocrResult.text
  }
  return ''
}

const pickBrandCandidate = (body: Record<string, unknown>): string | undefined => {
  if (typeof body.brand === 'string' && body.brand.trim()) {
    return body.brand
  }
  const ocrResult = body.ocrResult as Record<string, unknown> | undefined
  if (ocrResult && typeof ocrResult.brand === 'string' && ocrResult.brand.trim()) {
    return ocrResult.brand
  }
  return undefined
}

export const POST = withErrorHandling(async (request: NextRequest): Promise<NextResponse> => {
  const rateLimitResult = withRateLimit(RateLimitConfigs.AI_ANALYSIS)(request)

  try {
    const body = (await request.json()) as Record<string, unknown>
    const rawText = extractTextPayload(body)
    const cleanedText = cleanText(rawText)

    const providedBrand = pickBrandCandidate(body)
    let normalizedBrand = normalizeBrandName(providedBrand)
    if (!normalizedBrand) {
      const detected = detectBrandFromText(cleanedText)
      normalizedBrand = normalizeBrandName(detected)
    }

    const searchPlan = buildSearchQuery(cleanedText, normalizedBrand)

    if (!searchPlan.query) {
      const response = createSuccessResponse({
        ok: false,
        message: 'No supplement match found',
        confidence: 0,
        analysis: null,
        matches: [],
        searchMeta: {
          query: '',
          normalized: '',
          tokens: [],
          brand: normalizedBrand ?? null,
          resultCount: 0,
        },
      })
      attachRateLimitHeaders(response, rateLimitResult)
      return response
    }

    const { normalization, supplements } = await runDatabaseSearch(
      searchPlan.query,
      normalizedBrand,
    )

    const searchMeta = {
      query: searchPlan.query,
      normalized: normalization.cleaned,
      tokens: normalization.tokens,
      brand: normalizedBrand ?? null,
      resultCount: supplements.length,
    }

    console.log('[ANALYZE_SEARCH]', {
      query: searchPlan.query,
      brand: normalizedBrand,
      normalized: normalization.cleaned,
      tokens: normalization.tokens,
      resultCount: supplements.length,
    })

    if (supplements.length === 0) {
      const response = createSuccessResponse({
        ok: false,
        message: 'No supplement match found',
        confidence: 0,
        analysis: null,
        matches: [],
        searchMeta,
      })
      attachRateLimitHeaders(response, rateLimitResult)
      return response
    }

    const bestMatch = supplements[0]
    const parsedIngredients = parseIngredients(bestMatch.ingredients)
    const ingredientNames = parsedIngredients.map(item => item.name).filter(Boolean)
    const highlightedIngredients = ingredientNames.slice(0, 4).join(', ')
    const sanitizedBrand = normalizedBrand ? sanitizeForMatching(normalizedBrand) : ''
    const matchBrandSanitized = sanitizeForMatching(bestMatch.brand ?? '')
    const brandMatched =
      Boolean(sanitizedBrand) && matchBrandSanitized.includes(sanitizedBrand)

    const tokenSet = new Set(normalization.tokens.map(token => sanitizeForMatching(token)))
    const matchNameTokens = sanitizeForMatching(bestMatch.name ?? '').split(' ').filter(Boolean)
    const sharedTokens = matchNameTokens.filter(token => token.length > 2 && tokenSet.has(token)).length

    let confidence = 0.62
    if (brandMatched) confidence += 0.18
    if (bestMatch.verified) confidence += 0.08
    if (sharedTokens >= 2) confidence += 0.06
    if (sharedTokens >= 4) confidence += 0.04
    confidence = Math.min(0.98, confidence)

    const generatedSummary = {
      basicIntroduction: `${bestMatch.brand} ${bestMatch.name} is classified as a ${bestMatch.category.toLowerCase()} supplement found in the local database.`,
      primaryBenefits: highlightedIngredients
        ? `Key ingredients include ${highlightedIngredients}, supporting the ${bestMatch.category.toLowerCase()} focus.`
        : `This product supports the ${bestMatch.category.toLowerCase()} category based on its labeled formulation.`,
      rdaGuidelines:
        'Follow the serving size on the label and coordinate with a healthcare professional before adjusting dosage.',
      safetyLimits:
        'Do not exceed the labeled serving unless your healthcare provider recommends it. Check for interactions with existing medications.',
      dietarySources: highlightedIngredients
        ? `Natural sources that also contain ${highlightedIngredients} can complement supplementation.`
        : 'Review dietary sources that align with the supplement’s active ingredients to optimize intake.',
      supplementForms:
        'Common delivery forms include capsules, tablets, or powders. Verify the packaging for exact format.',
      usageScenarios:
        'Use when dietary intake is insufficient or when specific support for the labeled category is desired.',
      risksPrecautions:
        'Consult a professional if pregnant, nursing, managing chronic conditions, or combining with other supplements.',
    }

    const analysisPayload = {
      supplementName: bestMatch.name,
      brand: bestMatch.brand,
      confidence,
      analysis: generatedSummary,
      ingredients: parsedIngredients,
      warnings: bestMatch.verified
        ? []
        : [
            'This record is not yet verified in the database. Double-check label details before relying on the information.',
          ],
      recommendations: [
        'Compare the label’s serving size with personal health goals or practitioner guidance.',
        'Review potential allergens or sensitivities listed on the supplement facts panel.',
      ],
      references: [],
      scanId:
        typeof body.scanId === 'string' && body.scanId.trim()
          ? (body.scanId as string)
          : randomUUID(),
      supplementId: bestMatch.id,
      cached: false,
      ocrConfidence:
        typeof (body.ocrResult as Record<string, unknown> | undefined)?.confidence === 'number'
          ? ((body.ocrResult as Record<string, unknown>).confidence as number)
          : undefined,
      analysisMethod: 'database_search',
      sources: ['database', cleanedText ? 'label_text' : 'user_input'],
    }

    const response = createSuccessResponse({
      ok: true,
      confidence,
      analysis: analysisPayload,
      matches: supplements,
      searchMeta,
    })
    attachRateLimitHeaders(response, rateLimitResult)
    return response
  } catch (error) {
    console.error('[ANALYZE_ERROR]', error)
    const message = error instanceof Error ? error.message : 'Analysis failed'
    const response = NextResponse.json(
      {
        success: false,
        error: 'ANALYSIS_ERROR',
        message,
      },
      { status: 500 },
    )
    attachRateLimitHeaders(response, rateLimitResult)
    return response
  }
})

export const GET = withErrorHandling(async (): Promise<NextResponse> => {
  return NextResponse.json({
    success: true,
    message: 'Analysis API ready',
    supportedInputs: ['text', 'ocrResult', 'brand'],
    methods: ['POST'],
    rateLimit: 'Max 5 requests per minute',
  })
})
