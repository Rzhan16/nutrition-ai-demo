import { NextRequest } from 'next/server'
import { mockSupplements } from '@/lib/mock-data'

/**
 * Simple search endpoint that works without database
 * Used for Vercel deployment when database is not available
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const category = searchParams.get('category') || undefined
    const brand = searchParams.get('brand') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const offset = (page - 1) * limit
    
    // Filter supplements based on query
    let filteredSupplements = mockSupplements
    
    if (query) {
      filteredSupplements = filteredSupplements.filter(supplement =>
        supplement.name.toLowerCase().includes(query.toLowerCase()) ||
        supplement.brand.toLowerCase().includes(query.toLowerCase()) ||
        supplement.category.toLowerCase().includes(query.toLowerCase())
      )
    }
    
    if (category) {
      filteredSupplements = filteredSupplements.filter(supplement =>
        supplement.category.toLowerCase().includes(category.toLowerCase())
      )
    }
    
    if (brand) {
      filteredSupplements = filteredSupplements.filter(supplement =>
        supplement.brand.toLowerCase().includes(brand.toLowerCase())
      )
    }
    
    // Apply pagination
    const total = filteredSupplements.length
    const paginatedSupplements = filteredSupplements.slice(offset, offset + limit)
    
    // Add relevance scores
    const scoredSupplements = paginatedSupplements.map(supplement => ({
      ...supplement,
      relevanceScore: Math.random() * 10 + 5 // Mock relevance score
    }))
    
    return Response.json({
      success: true,
      data: {
        supplements: scoredSupplements,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        suggestions: {
          categories: ['Vitamins', 'Minerals', 'Omega-3', 'Probiotics', 'Antioxidants'],
          brands: ['Pure Encapsulations', 'Thorne', 'Life Extension', 'NOW Foods', 'Nordic Naturals'],
          popularSearches: ['Vitamin D3', 'Omega 3', 'Magnesium', 'Probiotics', 'Vitamin B12']
        },
        searchMeta: {
          query,
          filters: { category, brand },
          resultCount: scoredSupplements.length
        }
      }
    })
    
  } catch (error) {
    return Response.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An error occurred while searching'
    }, { status: 500 })
  }
}