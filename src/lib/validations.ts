import { z } from 'zod'

type FileLikeInput = {
  size: number
  type: string
}

const fileLikeSchema = z.custom<FileLikeInput>((value) => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<FileLikeInput>
  return typeof candidate.size === 'number' && typeof candidate.type === 'string'
}, {
  message: 'Please upload a valid image file'
})

// Image upload validation
export const imageUploadSchema = z.object({
  file: fileLikeSchema
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB')
    .refine(
      (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      'Only JPEG, PNG, and WebP images are allowed'
    ),
})

// OCR analysis request validation
export const ocrAnalysisSchema = z.object({
  imageUrl: z.string().min(1, 'Image URL is required').refine(
    (url) => {
      // Allow HTTP/HTTPS URLs and blob URLs
      return url.startsWith('http://') || 
             url.startsWith('https://') || 
             url.startsWith('blob:') ||
             url.startsWith('/uploads/');
    },
    'Invalid image URL format'
  ),
  userId: z.string().optional(),
})

// Text analysis request validation
export const textAnalysisSchema = z.object({
  text: z.string().min(1, 'Text input is required').max(5000, 'Text too long'),
  userId: z.string().optional(),
})

// Search request validation
export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100, 'Query too long'),
  category: z.string().optional(),
  brand: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
})

// Supplement creation validation
export const supplementSchema = z.object({
  name: z.string().min(1, 'Supplement name is required'),
  brand: z.string().min(1, 'Brand is required'),
  category: z.string().min(1, 'Category is required'),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string(),
    unit: z.string(),
  })),
  imageUrl: z.string().url().optional(),
  verified: z.boolean().default(false),
})

// User preferences validation
export const userPreferencesSchema = z.object({
  dietaryRestrictions: z.array(z.string()).optional(),
  healthGoals: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  age: z.number().int().min(13).max(120).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
})

// API response schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

// OCR result schema
export const ocrResultSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  boundingBoxes: z.array(z.object({
    text: z.string(),
    confidence: z.number(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })).optional(),
})

// AI analysis result schema
export const aiAnalysisSchema = z.object({
  supplementName: z.string(),
  brand: z.string().optional(),
  confidence: z.number().min(0).max(1),
  analysis: z.object({
    basicIntroduction: z.string(),
    primaryBenefits: z.string(),
    rdaGuidelines: z.string(),
    safetyLimits: z.string(),
    dietarySources: z.string(),
    supplementForms: z.string(),
    usageScenarios: z.string(),
    risksPrecautions: z.string(),
  }),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string(),
    unit: z.string(),
    dailyValue: z.number().optional(),
  })),
  warnings: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
})

export type ImageUploadInput = z.infer<typeof imageUploadSchema>
export type OCRAnalysisInput = z.infer<typeof ocrAnalysisSchema>
export type TextAnalysisInput = z.infer<typeof textAnalysisSchema>
export type SearchInput = z.infer<typeof searchSchema>
export type SupplementInput = z.infer<typeof supplementSchema>
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>
export type APIResponse = z.infer<typeof apiResponseSchema>
export type OcrResultShape = z.infer<typeof ocrResultSchema>
export type AIAnalysisResult = z.infer<typeof aiAnalysisSchema>
