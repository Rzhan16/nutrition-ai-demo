import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

/**
 * Comprehensive error handling utilities for API routes
 */

export interface APIError {
  code: string
  message: string
  details?: any
  statusCode: number
}

export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: any

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

// Common error types
export const ErrorCodes = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // File upload errors
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  
  // External service errors
  OCR_SERVICE_ERROR: 'OCR_SERVICE_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

/**
 * Handle different types of errors and return appropriate responses
 */
export function handleError(error: unknown): NextResponse {
  console.error('API Error:', error)

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      },
      { status: 400 }
    )
  }

  // Custom application errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: error.code,
        message: error.message,
        details: error.details
      },
      { status: error.statusCode }
    )
  }

  // Database errors
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as any
    if (dbError.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: ErrorCodes.DUPLICATE_RECORD,
          message: 'Record already exists',
          details: dbError.meta
        },
        { status: 409 }
      )
    }
    
    if (dbError.code === 'P2025') {
      return NextResponse.json(
        {
          success: false,
          error: ErrorCodes.RECORD_NOT_FOUND,
          message: 'Record not found',
          details: dbError.meta
        },
        { status: 404 }
      )
    }
  }

  // Generic error fallback
  return NextResponse.json(
    {
      success: false,
      error: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    },
    { status: 500 }
  )
}

/**
 * Rate limiting error
 */
export function createRateLimitError(limit: number, windowMs: number): AppError {
  return new AppError(
    `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds`,
    429,
    ErrorCodes.RATE_LIMIT_EXCEEDED,
    { limit, windowMs }
  )
}

/**
 * Validation error helper
 */
export function createValidationError(message: string, field?: string): AppError {
  return new AppError(
    message,
    400,
    ErrorCodes.VALIDATION_ERROR,
    field ? { field } : undefined
  )
}

/**
 * File upload error helpers
 */
export function createFileTooLargeError(maxSize: number): AppError {
  return new AppError(
    `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
    413,
    ErrorCodes.FILE_TOO_LARGE,
    { maxSize }
  )
}

export function createInvalidFileTypeError(allowedTypes: string[]): AppError {
  return new AppError(
    `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
    400,
    ErrorCodes.INVALID_FILE_TYPE,
    { allowedTypes }
  )
}

/**
 * Database error helpers
 */
export function createRecordNotFoundError(resource: string, id?: string): AppError {
  return new AppError(
    `${resource} not found${id ? ` with ID: ${id}` : ''}`,
    404,
    ErrorCodes.RECORD_NOT_FOUND,
    { resource, id }
  )
}

/**
 * External service error helpers
 */
export function createOCRServiceError(details?: any): AppError {
  return new AppError(
    'OCR service temporarily unavailable',
    503,
    ErrorCodes.OCR_SERVICE_ERROR,
    details
  )
}

export function createAIServiceError(details?: any): AppError {
  return new AppError(
    'AI analysis service temporarily unavailable',
    503,
    ErrorCodes.AI_SERVICE_ERROR,
    details
  )
}

/**
 * Success response helper
 */
export function createSuccessResponse<T>(data: T, message?: string): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    message
  })
}

/**
 * Async error wrapper for API routes
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleError(error)
    }
  }
}

/**
 * Log error for monitoring (in production, integrate with your logging service)
 */
export function logError(error: unknown, context?: Record<string, any>) {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : String(error),
    context
  }
  
  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', errorInfo)
  }
  
  // In production, send to your logging service (e.g., Sentry, LogRocket, etc.)
  // Example: Sentry.captureException(error, { extra: context })
}
