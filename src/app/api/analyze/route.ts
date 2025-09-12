import { NextRequest } from 'next/server'
import { withErrorHandling, createSuccessResponse, createAIServiceError, createOCRServiceError } from '@/lib/error-handler'
import { withRateLimit, RateLimitConfigs, getRateLimitHeaders } from '@/lib/rate-limiter'
import { ocrAnalysisSchema, textAnalysisSchema, aiAnalysisSchema } from '@/lib/validations'
import { prisma } from '@/lib/db'
import { mockAnalysis } from '@/lib/mock-data'
import { z } from 'zod'

/**
 * POST /api/analyze
 * Accept image URL or text input and perform OCR + AI analysis
 * Integrates with OCR service and OpenAI API with structured prompts
 */

// Mock OCR service (replace with actual Tesseract.js or cloud OCR)
async function performOCR(imageUrl: string): Promise<{ text: string; confidence: number }> {
  // In a real implementation, you would:
  // 1. Download the image from the URL
  // 2. Process it with Tesseract.js or cloud OCR service
  // 3. Return extracted text with confidence score
  
  // For now, return mock data
  return {
    text: "Vitamin D3 1000 IU\nSupplement Facts\nServing Size: 1 capsule\nVitamin D3 (as cholecalciferol) 25 mcg (1000 IU)\nOther ingredients: Olive oil, gelatin capsule",
    confidence: 0.92
  }
}

// Mock OpenAI API call (replace with actual OpenAI integration)
async function performAIAnalysis(ocrText: string): Promise<any> {
  // In a real implementation, you would:
  // 1. Structure the prompt for 8-point analysis
  // 2. Call OpenAI API with proper error handling
  // 3. Parse and validate the response
  
  // For now, return mock analysis
  return {
    supplementName: "Vitamin D3",
    brand: "Generic",
    confidence: 0.88,
    analysis: {
      basicIntroduction: "Vitamin D3 (cholecalciferol) is a fat-soluble vitamin essential for bone health and immune function.",
      primaryBenefits: "Supports bone health, immune system function, and calcium absorption. May help prevent osteoporosis and support cardiovascular health.",
      rdaGuidelines: "Adults: 600-800 IU (15-20 mcg) daily. Higher doses may be needed for deficiency correction under medical supervision.",
      safetyLimits: "Upper limit: 4000 IU (100 mcg) daily for adults. Excessive intake can lead to hypercalcemia and kidney damage.",
      dietarySources: "Fatty fish (salmon, mackerel), fortified dairy products, egg yolks, and sunlight exposure.",
      supplementForms: "Capsules, tablets, liquid drops, and gummies. D3 (cholecalciferol) is more effective than D2 (ergocalciferol).",
      usageScenarios: "Recommended for individuals with limited sun exposure, darker skin, older adults, and those with bone health concerns.",
      risksPrecautions: "May interact with certain medications. Consult healthcare provider if taking blood thinners or have kidney disease."
    },
    ingredients: [
      {
        name: "Vitamin D3",
        amount: "25",
        unit: "mcg",
        dailyValue: 125
      }
    ],
    warnings: [
      "Keep out of reach of children",
      "Do not exceed recommended dosage",
      "Consult healthcare provider if pregnant or nursing"
    ],
    recommendations: [
      "Take with a meal containing fat for better absorption",
      "Consider testing vitamin D levels before and after supplementation",
      "Combine with calcium and magnesium for optimal bone health"
    ]
  }
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting
  const rateLimitResult = withRateLimit(RateLimitConfigs.AI_ANALYSIS)(request)
  
  try {
    const body = await request.json()
    
    // Determine if this is image or text analysis
    let ocrText: string
    let imageUrl: string | undefined
    let userId: string | undefined
    
    if (body.imageUrl) {
      // Image analysis
      const validatedData = ocrAnalysisSchema.parse(body)
      imageUrl = validatedData.imageUrl
      userId = validatedData.userId
      
      // Perform OCR
      try {
        const ocrResult = await performOCR(imageUrl)
        ocrText = ocrResult.text
        
        if (ocrResult.confidence < 0.7) {
          console.warn(`Low OCR confidence: ${ocrResult.confidence}`)
        }
      } catch (error) {
        throw createOCRServiceError({ imageUrl, error: String(error) })
      }
    } else if (body.text) {
      // Text analysis
      const validatedData = textAnalysisSchema.parse(body)
      ocrText = validatedData.text
      userId = validatedData.userId
    } else {
      throw new Error('Either imageUrl or text must be provided')
    }
    
    // Check if we have a cached analysis for this text
    let existingScan = null
    if (prisma) {
      try {
        existingScan = await prisma.scan.findFirst({
          where: {
            ocrText: ocrText,
            analysis: { not: null } as any
          },
          orderBy: { createdAt: 'desc' }
        })
      } catch (error) {
        console.log('Database not available, skipping cache check')
      }
    }
    
    if (existingScan && existingScan.analysis) {
      // Return cached analysis
      const response = createSuccessResponse({
        ...(existingScan.analysis as any),
        cached: true,
        scanId: existingScan.id
      }, 'Analysis retrieved from cache')
      
      const headers = getRateLimitHeaders(rateLimitResult)
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      
      return response
    }
    
    // Perform AI analysis
    let aiAnalysis
    try {
      aiAnalysis = await performAIAnalysis(ocrText)
      
      // Validate AI response
      aiAnalysisSchema.parse(aiAnalysis)
    } catch (error) {
      // Fallback to mock analysis if AI service fails
      console.log('AI service not available, using mock analysis')
      aiAnalysis = { ...mockAnalysis, scanId: `mock-${Date.now()}` }
    }
    
    // Save scan to database (if available)
    let scan = { id: `mock-scan-${Date.now()}` }
    let supplementId: string | undefined
    
    if (prisma) {
      try {
        scan = await prisma.scan.create({
          data: {
            imageUrl: imageUrl || '',
            ocrText,
            analysis: aiAnalysis,
            userId
          }
        })
        
        // Try to match with existing supplement
        if (aiAnalysis.supplementName && aiAnalysis.brand) {
          const supplement = await prisma.supplement.findFirst({
            where: {
              name: { contains: aiAnalysis.supplementName },
              brand: { contains: aiAnalysis.brand }
            }
          })
          
          if (supplement) {
            supplementId = supplement.id
            // Update scan with supplement reference
            await prisma.scan.update({
              where: { id: scan.id },
              data: { supplementId }
            })
          }
        }
      } catch (error) {
        console.log('Database not available, skipping scan save')
      }
    }
    
    // Return analysis result
    const response = createSuccessResponse({
      ...aiAnalysis,
      scanId: scan.id,
      supplementId,
      cached: false,
      ocrConfidence: ocrText ? 0.92 : undefined // Mock confidence
    }, 'Analysis completed successfully')
    
    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimitResult)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error // Let the error handler deal with Zod errors
    }
    throw error
  }
})

/**
 * GET /api/analyze
 * Get analysis history for a user
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting
  const rateLimitResult = withRateLimit(RateLimitConfigs.GENERAL)(request)
  
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const limit = parseInt(searchParams.get('limit') || '10')
  const offset = parseInt(searchParams.get('offset') || '0')
  
  if (!userId) {
    throw new Error('userId parameter is required')
  }
  
  const scans = await prisma.scan.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: {
      supplement: {
        select: {
          id: true,
          name: true,
          brand: true,
          category: true
        }
      }
    }
  })
  
  const total = await prisma.scan.count({
    where: { userId }
  })
  
  const response = createSuccessResponse({
    scans,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    }
  })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimitResult)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
})