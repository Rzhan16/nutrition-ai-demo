import { NextRequest } from 'next/server'
import { createRateLimitError } from './error-handler'

/**
 * Simple in-memory rate limiter for API endpoints
 * In production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string // Custom key generator
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Default key generator using IP address
 */
function defaultKeyGenerator(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  return ip
}

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const key = config.keyGenerator ? config.keyGenerator(req) : defaultKeyGenerator(req)
  const now = Date.now()
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired one
    entry = {
      count: 0,
      resetTime: now + config.windowMs
    }
    rateLimitStore.set(key, entry)
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    }
  }
  
  // Increment counter
  entry.count++
  rateLimitStore.set(key, entry)
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime
  }
}

/**
 * Rate limiting middleware for API routes
 */
export function withRateLimit(config: RateLimitConfig) {
  return function rateLimitMiddleware(req: NextRequest) {
    const result = checkRateLimit(req, config)
    
    if (!result.allowed) {
      throw createRateLimitError(config.maxRequests, config.windowMs)
    }
    
    return result
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // Strict limits for expensive operations
  AI_ANALYSIS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  },
  
  OCR_PROCESSING: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  
  // Moderate limits for search
  SEARCH: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  
  // Generous limits for general API usage
  GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  
  // Very strict for file uploads
  UPLOAD: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
  }
} as const

/**
 * User-based rate limiting (for authenticated users)
 */
export function createUserRateLimit(userId: string, config: RateLimitConfig) {
  return {
    ...config,
    keyGenerator: () => `user:${userId}`
  }
}

/**
 * IP-based rate limiting (for anonymous users)
 */
export function createIPRateLimit(config: RateLimitConfig) {
  return {
    ...config,
    keyGenerator: defaultKeyGenerator
  }
}

/**
 * Get rate limit headers for client
 */
export function getRateLimitHeaders(result: { remaining: number; resetTime: number }) {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
  }
}