/**
 * API client utilities for making requests to our backend endpoints
 * Includes proper error handling, type safety, and rate limiting awareness
 */

import { APIResponse, UploadResponse, AnalysisResponse, SearchResponse, ScanHistoryResponse } from './types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

/**
 * Generic API request function with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  }
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  }
  
  try {
    const response = await fetch(url, config)
    const data = await response.json()
    
    if (!response.ok) {
      throw new APIError(
        response.status,
        data.error || 'UNKNOWN_ERROR',
        data.message || 'An error occurred',
        data.details
      )
    }
    
    return data
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    
    // Network or other errors
    throw new APIError(
      0,
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network error occurred'
    )
  }
}

/**
 * Upload image file for analysis
 */
export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await apiRequest<UploadResponse>('/api/upload', {
    method: 'POST',
    headers: {}, // Let browser set Content-Type for FormData
    body: formData,
  })
  
  return response.data as any
}

/**
 * Analyze image or text for supplement information
 */
export async function analyzeSupplement(
  input: { imageUrl: string; userId?: string } | { text: string; userId?: string }
): Promise<AnalysisResponse> {
  const response = await apiRequest<AnalysisResponse>('/api/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  
  return response.data as any
}

/**
 * Search supplements in the database
 */
export async function searchSupplements(params: {
  query: string
  category?: string
  brand?: string
  page?: number
  limit?: number
}): Promise<SearchResponse> {
  const searchParams = new URLSearchParams()
  
  if (params.query) searchParams.set('q', params.query)
  if (params.category) searchParams.set('category', params.category)
  if (params.brand) searchParams.set('brand', params.brand)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  
  const response = await apiRequest<SearchResponse>(`/api/search?${searchParams}`)
  return response.data as any
}

/**
 * Advanced search with complex filters
 */
export async function advancedSearch(params: {
  query?: string
  filters?: {
    category?: string[]
    brand?: string[]
    verified?: boolean
  }
  sortBy?: 'name' | 'brand' | 'category' | 'created' | 'popularity' | 'relevance'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}): Promise<SearchResponse> {
  const response = await apiRequest<SearchResponse>('/api/search', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  
  return response.data!
}

/**
 * Get scan history for a user
 */
export async function getScanHistory(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ScanHistoryResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('userId', userId)
  
  if (options.limit) searchParams.set('limit', options.limit.toString())
  if (options.offset) searchParams.set('offset', options.offset.toString())
  
  const response = await apiRequest<ScanHistoryResponse>(`/api/analyze?${searchParams}`)
  return response.data!
}

/**
 * Get upload limits and information
 */
export async function getUploadInfo(): Promise<{
  limits: {
    maxFileSize: string
    allowedTypes: string[]
    maxDimensions: string
    processing: {
      compression: boolean
      optimization: boolean
      format: string
    }
  }
  rateLimit: {
    remaining: number
    resetTime: string
  }
}> {
  const response = await apiRequest('/api/upload')
  return response.data as any
}

/**
 * Utility function to check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  return error instanceof APIError && error.code === 'RATE_LIMIT_EXCEEDED'
}

/**
 * Utility function to get remaining time until rate limit resets
 */
export function getRateLimitResetTime(error: APIError): Date | null {
  if (isRateLimitError(error) && error.details?.resetTime) {
    return new Date(error.details.resetTime)
  }
  return null
}

/**
 * Retry function with exponential backoff for rate-limited requests
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (error instanceof APIError && isRateLimitError(error)) {
        const resetTime = getRateLimitResetTime(error)
        if (resetTime) {
          const waitTime = resetTime.getTime() - Date.now()
          if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime))
            continue
          }
        }
      }
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

// Export the API client instance
export const apiClient = {
  uploadImage,
  analyzeSupplement,
  searchSupplements,
  advancedSearch,
  getScanHistory,
  getUploadInfo,
  withRetry,
  isRateLimitError,
  getRateLimitResetTime,
}