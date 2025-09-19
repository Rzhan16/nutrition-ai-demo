import { NextRequest } from 'next/server'
import { withErrorHandling, createSuccessResponse, createFileTooLargeError, createInvalidFileTypeError } from '@/lib/error-handler'
import { withRateLimit, RateLimitConfigs, getRateLimitHeaders } from '@/lib/rate-limiter'
import { processImageForOCR, saveImageToUploads, generateUniqueFilename, validateImageFile } from '@/lib/image-processing'
import { imageUploadSchema } from '@/lib/validations'

interface FormDataFileLike {
  size: number
  type: string
  name?: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

const isFormDataFile = (value: unknown): value is FormDataFileLike => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<FormDataFileLike>
  return (
    typeof candidate.arrayBuffer === 'function' &&
    typeof candidate.size === 'number' &&
    typeof candidate.type === 'string'
  )
}

const inferFallbackExtension = (mimeType: string): string => {
  switch (mimeType) {
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
    case 'image/jpeg':
      return '.jpg'
    default:
      return '.bin'
  }
}

/**
 * POST /api/upload
 * Handle multipart form data for image uploads
 * Validates, processes, and stores images for OCR analysis
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting
  const rateLimitResult = withRateLimit(RateLimitConfigs.UPLOAD)(request)
  
  try {
    // Parse multipart form data
    const formData = await request.formData()
    const fileEntry = formData.get('file')

    if (!isFormDataFile(fileEntry)) {
      throw new Error('No file provided')
    }

    const originalName = typeof fileEntry.name === 'string' && fileEntry.name.trim().length
      ? fileEntry.name
      : `upload${inferFallbackExtension(fileEntry.type)}`

    // Validate file
    imageUploadSchema.parse({ file: fileEntry })
    const validation = validateImageFile(fileEntry)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Convert File to Buffer
    const arrayBuffer = await fileEntry.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Process image for OCR
    const processedImage = await processImageForOCR(buffer, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 85,
      format: 'jpeg'
    })

    // Generate unique filename
    const filename = generateUniqueFilename(originalName)
    
    // Save to uploads directory
    const imageUrl = await saveImageToUploads(
      processedImage.buffer,
      filename,
      'public/uploads'
    )
    
    // Return success response with metadata
    const response = createSuccessResponse({
      imageUrl,
      filename,
      metadata: processedImage.metadata,
      originalName,
      uploadedAt: new Date().toISOString()
    }, 'Image uploaded successfully')
    
    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimitResult)
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
    
  } catch (error) {
    // Handle specific file errors
    if (error instanceof Error) {
      if (error.message.includes('File size')) {
        throw createFileTooLargeError(10 * 1024 * 1024)
      }
      if (error.message.includes('file type')) {
        throw createInvalidFileTypeError(['image/jpeg', 'image/png', 'image/webp'])
      }
    }
    throw error
  }
})

/**
 * GET /api/upload
 * Get upload statistics and limits
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Apply rate limiting
  const rateLimitResult = withRateLimit(RateLimitConfigs.GENERAL)(request)
  
  const response = createSuccessResponse({
    limits: {
      maxFileSize: '10MB',
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxDimensions: '1920x1080',
      processing: {
        compression: true,
        optimization: true,
        format: 'jpeg'
      }
    },
    rateLimit: {
      remaining: rateLimitResult.remaining,
      resetTime: new Date(rateLimitResult.resetTime).toISOString()
    }
  })
  
  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimitResult)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
})
