import { NextRequest } from 'next/server'
import { withErrorHandling, createSuccessResponse } from '@/lib/error-handler'
import { withRateLimit, RateLimitConfigs, getRateLimitHeaders } from '@/lib/rate-limiter'
import { searchSchema } from '@/lib/validations'
import { prisma } from '@/lib/db'
import { mockSupplements } from '@/lib/mock-data'
import type { ParsedIngredient, Supplement } from '@/lib/types'

/**
 * GET /api/search
 * Full-text search in supplements with fuzzy matching and pagination
 */

// Simple fuzzy matching function (in production, consider using a proper search engine)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  
  if (s1 === s2) return 1
  
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length === 0) return 1
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting
  const rateLimitResult = withRateLimit(RateLimitConfigs.SEARCH)(request)
  
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const category = searchParams.get('category') || undefined
  const brand = searchParams.get('brand') || undefined
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  
  // Validate search parameters
  const validatedParams = searchSchema.parse({
    query,
    category,
    brand,
    page,
    limit
  })
  
  const { query: searchQuery, category: searchCategory, brand: searchBrand, page: currentPage, limit: pageSize } = validatedParams
  const offset = (currentPage - 1) * pageSize
  
  const db = prisma

  // Build where clause for database query
  const whereClause: any = {}
  
  if (searchQuery) {
    whereClause.OR = [
      { name: { contains: searchQuery } },
      { brand: { contains: searchQuery } },
      { category: { contains: searchQuery } }
    ]
  }
  
  if (searchCategory) {
    whereClause.category = { contains: searchCategory }
  }
  
  if (searchBrand) {
    whereClause.brand = { contains: searchBrand }
  }
  
  const filterMockSupplements = (): { items: Supplement[]; total: number } => {
    const filtered = mockSupplements.filter(supplement => {
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase()
        return (
          supplement.name.toLowerCase().includes(queryLower) ||
          supplement.brand.toLowerCase().includes(queryLower) ||
          supplement.category.toLowerCase().includes(queryLower)
        )
      }
      return true
    })
    return {
      items: filtered.slice(offset, offset + pageSize),
      total: filtered.length
    }
  }

  type RowResult = Supplement & { _count?: { scans: number } }

  const normalizeIngredients = (value: unknown): ParsedIngredient[] =>
    Array.isArray(value) ? (value as ParsedIngredient[]) : []

  const getScanCount = (row: { _count?: { scans: number } } | undefined): number =>
    row?._count?.scans ?? 0

  // Execute database query with fallback to mock data
  let rows: RowResult[] = []
  let total = 0

  if (db) {
    try {
      const [dbRows, dbTotal] = await Promise.all([
        db.supplement.findMany({
          where: whereClause,
          orderBy: [
            { verified: 'desc' }, // Verified supplements first
            { createdAt: 'desc' }
          ],
          take: pageSize,
          skip: offset,
          include: {
            _count: {
              select: { scans: true }
            }
          }
        }),
        db.supplement.count({ where: whereClause })
      ])
      const toRowResult = (row: (typeof dbRows)[number]): RowResult => ({
        ...row,
        imageUrl: row.imageUrl ?? undefined,
        ingredients: normalizeIngredients(row.ingredients),
      })
      rows = dbRows.map(toRowResult)
      total = dbTotal
    } catch (error) {
      console.log('Database not available, using mock data')
      const mockResults = filterMockSupplements()
      rows = mockResults.items as RowResult[]
      total = mockResults.total
    }
  } else {
    console.log('Prisma not available, using mock data')
    const mockResults = filterMockSupplements()
    rows = mockResults.items as RowResult[]
    total = mockResults.total
  }
  
  const supplements: Supplement[] = rows.map(({ _count, ...supplement }): Supplement => supplement)
  
  // Apply fuzzy matching and scoring
  const scoredSupplements = supplements.map((supplement, index) => {
    const sourceRow = rows[index]
    let score = 0
    
    // Exact matches get highest score
    if (supplement.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      score += 10
    }
    if (supplement.brand.toLowerCase().includes(searchQuery.toLowerCase())) {
      score += 8
    }
    if (supplement.category.toLowerCase().includes(searchQuery.toLowerCase())) {
      score += 6
    }
    
    // Fuzzy matching for partial matches
    if (searchQuery) {
      const nameSimilarity = calculateSimilarity(supplement.name, searchQuery)
      const brandSimilarity = calculateSimilarity(supplement.brand, searchQuery)
      const categorySimilarity = calculateSimilarity(supplement.category, searchQuery)
      
      score += nameSimilarity * 5
      score += brandSimilarity * 3
      score += categorySimilarity * 2
    }
    
    // Boost verified supplements
    if (supplement.verified) {
      score += 2
    }
    
    // Boost popular supplements (more scans)
    score += Math.min(getScanCount(sourceRow) * 0.1, 2)
    
    return {
      ...supplement,
      relevanceScore: score
    }
  })
  
  // Sort by relevance score
  scoredSupplements.sort((a, b) => b.relevanceScore - a.relevanceScore)
  
  // Get category suggestions
  const categories = db
    ? await db.supplement.findMany({
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' }
      })
    : Array.from(
        new Set(
          mockSupplements
            .map(supplement => supplement.category)
            .filter((category): category is string => typeof category === 'string' && category.length > 0)
        )
      ).map(category => ({ category }))
  
  // Get brand suggestions
  const brands = db
    ? await db.supplement.findMany({
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' }
      })
    : Array.from(
        new Set(
          mockSupplements
            .map(supplement => supplement.brand)
            .filter((brand): brand is string => typeof brand === 'string' && brand.length > 0)
        )
      ).map(brand => ({ brand }))
  
  // Get popular searches (mock data for now)
  const popularSearches = [
    'Vitamin D3',
    'Omega 3',
    'Magnesium',
    'Probiotics',
    'Vitamin B12',
    'Iron',
    'Calcium',
    'Zinc'
  ]
  
  const response = createSuccessResponse({
    supplements: scoredSupplements,
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: currentPage < Math.ceil(total / pageSize),
      hasPrev: currentPage > 1
    },
    suggestions: {
      categories: categories.map(c => c.category),
      brands: brands.map(b => b.brand),
      popularSearches
    },
    searchMeta: {
      query: searchQuery,
      filters: {
        category: searchCategory,
        brand: searchBrand
      },
      resultCount: scoredSupplements.length
    }
  })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimitResult)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
})

/**
 * POST /api/search
 * Advanced search with complex filters and sorting
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting
  const rateLimitResult = withRateLimit(RateLimitConfigs.SEARCH)(request)
  
  const db = prisma
  if (!db) {
    throw new Error('Prisma client not initialized')
  }
  
  const body = await request.json()
  const {
    query,
    filters = {},
    sortBy = 'relevance',
    sortOrder = 'desc',
    page = 1,
    limit = 10
  } = body
  
  const offset = (page - 1) * limit
  
  // Build advanced where clause
  const whereClause: any = {}
  
  if (query) {
    whereClause.OR = [
      { name: { contains: query } },
      { brand: { contains: query } },
      { category: { contains: query } }
    ]
  }
  
  // Apply filters
  if (filters.category) {
    whereClause.category = { in: Array.isArray(filters.category) ? filters.category : [filters.category] }
  }
  
  if (filters.brand) {
    whereClause.brand = { in: Array.isArray(filters.brand) ? filters.brand : [filters.brand] }
  }
  
  if (filters.verified !== undefined) {
    whereClause.verified = filters.verified
  }
  
  if (filters.minPrice || filters.maxPrice) {
    // Note: This would require adding price fields to the schema
    // For now, we'll skip price filtering
  }
  
  // Build order by clause
  let orderBy: any = {}
  switch (sortBy) {
    case 'name':
      orderBy = { name: sortOrder }
      break
    case 'brand':
      orderBy = { brand: sortOrder }
      break
    case 'category':
      orderBy = { category: sortOrder }
      break
    case 'created':
      orderBy = { createdAt: sortOrder }
      break
    case 'popularity':
      orderBy = { scans: { _count: sortOrder } }
      break
    default:
      orderBy = [
        { verified: 'desc' },
        { createdAt: 'desc' }
      ]
  }
  
  // Execute query
  const [supplements, total] = await Promise.all([
    db.supplement.findMany({
      where: whereClause,
      orderBy,
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { scans: true }
        }
      }
    }),
    db.supplement.count({ where: whereClause })
  ])
  
  const response = createSuccessResponse({
    supplements,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    },
    searchMeta: {
      query,
      filters,
      sortBy,
      sortOrder,
      resultCount: supplements.length
    }
  })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimitResult)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
})
