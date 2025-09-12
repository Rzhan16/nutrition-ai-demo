import { NextRequest } from 'next/server'
import { mockAnalysis } from '@/lib/mock-data'

/**
 * Simple analyze endpoint that works without database
 * Used for Vercel deployment when database is not available
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    if (!body.text && !body.imageUrl) {
      return Response.json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Either text or imageUrl must be provided'
      }, { status: 400 })
    }
    
    // Return mock analysis
    const analysis = {
      ...mockAnalysis,
      scanId: `mock-scan-${Date.now()}`,
      cached: false,
      ocrConfidence: 0.92
    }
    
    return Response.json({
      success: true,
      data: analysis,
      message: 'Analysis completed successfully (mock data)'
    })
    
  } catch (error) {
    return Response.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An error occurred during analysis'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return Response.json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'userId parameter is required'
      }, { status: 400 })
    }
    
    // Return mock scan history
    const mockScans = [
      {
        id: 'mock-scan-1',
        imageUrl: '/uploads/mock-scan-1.jpg',
        ocrText: 'Vitamin D3 1000 IU Supplement Facts',
        analysis: mockAnalysis,
        userId,
        createdAt: new Date().toISOString(),
        supplement: {
          id: 'mock-supplement-1',
          name: 'Vitamin D3',
          brand: 'Generic',
          category: 'Vitamins'
        }
      }
    ]
    
    return Response.json({
      success: true,
      data: {
        scans: mockScans,
        pagination: {
          total: 1,
          limit: 10,
          offset: 0,
          hasMore: false
        }
      }
    })
    
  } catch (error) {
    return Response.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An error occurred while retrieving scan history'
    }, { status: 500 })
  }
}