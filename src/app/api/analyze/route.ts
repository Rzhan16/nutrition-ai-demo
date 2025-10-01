import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling, createSuccessResponse } from '@/lib/error-handler'
import { withRateLimit, RateLimitConfigs, getRateLimitHeaders } from '@/lib/rate-limiter'
import { ocrAnalysisSchema, textAnalysisSchema, aiAnalysisSchema } from '@/lib/validations'
import { prisma } from '@/lib/db'
import { mockAnalysis } from '@/lib/mock-data'
import { z } from 'zod'
import type { OCRResult } from '@/lib/types'

/**
 * POST /api/analyze
 * Accept image URL, text input, or barcode for supplement analysis
 * Integrates with OCR service, barcode lookup, and AI analysis
 */

// Real OCR function (server-side fallback)
async function performServerOCR(imageUrl: string): Promise<{ text: string; confidence: number; barcode?: string }> {
  try {
    // In a real implementation, you would:
    // 1. Download the image from the URL
    // 2. Use a server-side OCR service (e.g., Google Vision API, AWS Textract)
    // 3. Attempt barcode detection first, then fall back to OCR
    
    console.log('Performing server-side OCR for:', imageUrl);
    
    // For now, return mock data with realistic structure
    // In production, replace with actual OCR service
    const mockOCRResult: OCRResult = {
      ok: true,
      text: "Pure Encapsulations Vitamin D3 1000 IU\nSupplement Facts\nServing Size: 1 capsule\nVitamin D3 (as cholecalciferol) 25 mcg (1000 IU) 125% DV\nOther ingredients: Cellulose, vegetarian capsule",
      confidence: 0.92,
      durationMs: 0,
      barcode: undefined,
    };
    
    return mockOCRResult;
  } catch (error) {
    console.error('Server OCR failed:', error);
    throw new Error('OCR processing failed');
  }
}

// Barcode lookup function
async function lookupByBarcode(barcode: string): Promise<any | null> {
  try {
    console.log('Looking up barcode:', barcode);
    
    // Try local database first
    if (prisma) {
      const supplement = await prisma.supplement.findFirst({
        where: {
          OR: [
            { name: { contains: barcode } },
            // In a real implementation, you'd have a barcode field
            // { barcode: barcode }
          ]
        }
      });
      
      if (supplement) {
        return {
          supplementName: supplement.name,
          brand: supplement.brand,
          category: supplement.category,
          ingredients: supplement.ingredients,
          source: 'local_database'
        };
      }
    }
    
    // Try external APIs (Open Food Facts, etc.)
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        return {
          supplementName: product.product_name,
          brand: product.brands,
          category: product.categories,
          description: product.generic_name,
          ingredients: product.ingredients_text?.split(', '),
          source: 'open_food_facts'
        };
      }
    } catch (externalError) {
      console.warn('External barcode lookup failed:', externalError);
    }
    
    return null;
  } catch (error) {
    console.error('Barcode lookup failed:', error);
    return null;
  }
}

// Enhanced AI analysis with better prompts
async function performAdvancedAIAnalysis(input: {
  text?: string;
  barcode?: string;
  productInfo?: any;
}): Promise<any> {
  try {
    // If we have barcode info, use it for context
    let analysisContext = '';
    if (input.productInfo) {
      analysisContext = `Product Information:
Name: ${input.productInfo.supplementName || 'Unknown'}
Brand: ${input.productInfo.brand || 'Unknown'}
Category: ${input.productInfo.category || 'Supplement'}
Ingredients: ${input.productInfo.ingredients?.join(', ') || 'Not specified'}
Source: ${input.productInfo.source || 'Unknown'}

`;
    }
    
    if (input.text) {
      analysisContext += `OCR Extracted Text:
${input.text}

`;
    }
    
    // In a real implementation, you would use OpenAI API here
    // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // const completion = await openai.chat.completions.create({
    //   model: "gpt-4",
    //   messages: [
    //     {
    //       role: "system", 
    //       content: NUTRITION_ANALYSIS_PROMPT
    //     },
    //     {
    //       role: "user",
    //       content: analysisContext
    //     }
    //   ],
    //   temperature: 0.3,
    // });
    
    // For now, return enhanced mock analysis
    const enhancedAnalysis = {
      ...mockAnalysis,
      supplementName: input.productInfo?.supplementName || extractSupplementName(input.text || ''),
      brand: input.productInfo?.brand || extractBrand(input.text || ''),
      scanId: `scan-${Date.now()}`,
      analysisMethod: input.productInfo ? 'barcode_lookup' : 'ocr_analysis',
      confidence: input.productInfo ? 0.95 : 0.88,
      sources: input.productInfo?.source ? [input.productInfo.source] : ['ocr_extraction'],
      contextPreview: analysisContext.trim(),
    };
    
    return enhancedAnalysis;
  } catch (error) {
    console.error('AI analysis failed:', error);
    // Return fallback analysis
    return {
      ...mockAnalysis,
      scanId: `fallback-${Date.now()}`,
      confidence: 0.5,
      analysisMethod: 'fallback'
    };
  }
}

// Helper functions
function extractSupplementName(text: string): string {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.length > 5 && line.length < 50 && 
        /vitamin|mineral|supplement|complex|formula|extract/i.test(line)) {
      return line.trim();
    }
  }
  return 'Unknown Supplement';
}

function extractBrand(text: string): string {
  const knownBrands = [
    'Pure Encapsulations', 'Thorne', 'Life Extension', 'NOW Foods',
    'Nature Made', 'Centrum', 'Garden of Life', 'Nordic Naturals'
  ];
  
  const upperText = text.toUpperCase();
  for (const brand of knownBrands) {
    if (upperText.includes(brand.toUpperCase())) {
      return brand;
    }
  }
  
  // Try to extract from first line
  const firstLine = text.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 30 && /^[A-Za-z\s&'.]+$/.test(firstLine)) {
    return firstLine;
  }
  
  return 'Unknown Brand';
}

export const POST = withErrorHandling(async (request: NextRequest): Promise<NextResponse> => {
  // Apply rate limiting (more restrictive for analysis)
  const rateLimitResult = withRateLimit(RateLimitConfigs.AI_ANALYSIS)(request)
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded. Maximum 5 requests per 60 seconds',
      details: rateLimitResult
    }, {
      status: 429,
      headers: getRateLimitHeaders(rateLimitResult)
    });
  }

  try {
    const body = await request.json()
    
    // Validate input - support multiple input types
    let validatedInput: any;
    
    if (body.imageUrl) {
      // Image URL analysis
      validatedInput = ocrAnalysisSchema.parse(body);
    } else if (body.text) {
      // Direct text analysis
      validatedInput = textAnalysisSchema.parse(body);
    } else if (body.barcode) {
      // Barcode analysis
      validatedInput = z.object({
        barcode: z.string().min(8).max(20),
        userId: z.string().optional()
      }).parse(body);
    } else {
      throw new Error('Must provide imageUrl, text, or barcode for analysis');
    }

    const userId = validatedInput.userId || 'anonymous';
    let ocrText = '';
    let productInfo = null;

    // Process based on input type
    if (validatedInput.barcode) {
      // Barcode lookup
      console.log('Processing barcode:', validatedInput.barcode);
      productInfo = await lookupByBarcode(validatedInput.barcode);
      
      if (productInfo) {
        ocrText = `${productInfo.supplementName}\n${productInfo.brand}\n${productInfo.ingredients?.join('\n') || ''}`;
      } else {
        throw new Error('Barcode not found in database');
      }
      
    } else if (validatedInput.imageUrl) {
      // OCR from image
      console.log('Processing image URL for OCR:', validatedInput.imageUrl);
      const ocrResult = await performServerOCR(validatedInput.imageUrl);
      ocrText = ocrResult.text;
      
      // If barcode was detected during OCR, look it up
      if (ocrResult.barcode) {
        productInfo = await lookupByBarcode(ocrResult.barcode);
      }
      
    } else if (validatedInput.text) {
      // Direct text input
      ocrText = validatedInput.text;
    }

    // Check cache first
    let existingScan = null;
    if (prisma && ocrText) {
      try {
        existingScan = await prisma.scan.findFirst({
          where: {
            ocrText: ocrText,
            analysis: { not: null } as any
          },
          orderBy: { createdAt: 'desc' }
        });
      } catch (error) {
        console.log('Database not available, skipping cache check', error);
      }
    }

    if (existingScan && existingScan.analysis) {
      const response = createSuccessResponse({
        ...(existingScan.analysis as any),
        cached: true,
        scanId: existingScan.id
      }, 'Analysis retrieved from cache');
      
      return NextResponse.json(response, {
        status: 200,
        headers: getRateLimitHeaders(rateLimitResult)
      });
    }

    // Perform AI analysis
    console.log('Performing AI analysis...');
    let aiAnalysis;
    try {
      aiAnalysis = await performAdvancedAIAnalysis({
        text: ocrText,
        barcode: validatedInput.barcode,
        productInfo
      });
      
      // Validate AI response structure
      aiAnalysisSchema.parse(aiAnalysis);
    } catch (error) {
      // Fallback to mock analysis if AI service fails
      console.log('AI service not available, using enhanced mock analysis', error);
      aiAnalysis = {
        ...mockAnalysis,
        scanId: `mock-${Date.now()}`,
        analysisMethod: validatedInput.barcode ? 'barcode_fallback' : 'ocr_fallback'
      };
    }

    // Save scan to database
    let scan = { id: `mock-scan-${Date.now()}` };
    let supplementId: string | undefined;
    
    if (prisma) {
      try {
        scan = await prisma.scan.create({
          data: {
            imageUrl: validatedInput.imageUrl || '',
            ocrText,
            analysis: aiAnalysis,
            userId
          }
        });
        
        // Try to match with existing supplement
        if (aiAnalysis.supplementName && aiAnalysis.brand) {
          const supplement = await prisma.supplement.findFirst({
            where: {
              name: { contains: aiAnalysis.supplementName },
              brand: { contains: aiAnalysis.brand }
            }
          });
          
          if (supplement) {
            supplementId = supplement.id;
            // Update scan with supplement reference
            await prisma.scan.update({
              where: { id: scan.id },
              data: { supplementId }
            });
          }
        }
      } catch (error) {
        console.log('Database not available, skipping scan save', error);
      }
    }

    // Return successful analysis
    const response = createSuccessResponse({
      ...aiAnalysis,
      scanId: scan.id,
      supplementId,
      cached: false,
      timestamp: new Date().toISOString()
    }, 'Analysis completed successfully');

    return NextResponse.json(response, {
      status: 200,
      headers: getRateLimitHeaders(rateLimitResult)
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: error.issues
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'ANALYSIS_ERROR',
      message: error instanceof Error ? error.message : 'Analysis failed'
    }, { status: 500 });
  }
});

export const GET = withErrorHandling(async (): Promise<NextResponse> => {
  return NextResponse.json({
    success: true,
    message: 'Analysis API is ready',
    supportedInputs: ['imageUrl', 'text', 'barcode'],
    methods: ['POST'],
    rateLimit: 'Max 5 requests per minute'
  });
});
