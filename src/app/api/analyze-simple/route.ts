import { NextRequest } from 'next/server'

// Mock analysis data (inline to avoid import issues)
const mockAnalysis = {
  supplementName: 'Vitamin D3',
  brand: 'Generic',
  confidence: 0.88,
  analysis: {
    basicIntroduction: 'Vitamin D3 (cholecalciferol) is a fat-soluble vitamin essential for bone health and immune function.',
    primaryBenefits: 'Supports bone health, immune system function, and calcium absorption. May help prevent osteoporosis and support cardiovascular health.',
    rdaGuidelines: 'Adults: 600-800 IU (15-20 mcg) daily. Higher doses may be needed for deficiency correction under medical supervision.',
    safetyLimits: 'Upper limit: 4000 IU (100 mcg) daily for adults. Excessive intake can lead to hypercalcemia and kidney damage.',
    dietarySources: 'Fatty fish (salmon, mackerel), fortified dairy products, egg yolks, and sunlight exposure.',
    supplementForms: 'Capsules, tablets, liquid drops, and gummies. D3 (cholecalciferol) is more effective than D2 (ergocalciferol).',
    usageScenarios: 'Recommended for individuals with limited sun exposure, darker skin, older adults, and those with bone health concerns.',
    risksPrecautions: 'May interact with certain medications. Consult healthcare provider if taking blood thinners or have kidney disease.'
  },
  ingredients: [
    {
      name: 'Vitamin D3',
      amount: '25',
      unit: 'mcg',
      dailyValue: 125
    }
  ],
  warnings: [
    'Keep out of reach of children',
    'Do not exceed recommended dosage',
    'Consult healthcare provider if pregnant or nursing'
  ],
  recommendations: [
    'Take with a meal containing fat for better absorption',
    'Consider testing vitamin D levels before and after supplementation',
    'Combine with calcium and magnesium for optimal bone health'
  ],
  scanId: 'mock-scan-1',
  cached: false,
  ocrConfidence: 0.92
}

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
    
  } catch {
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
    
  } catch {
    return Response.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An error occurred while retrieving scan history'
    }, { status: 500 })
  }
}
