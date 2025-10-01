import sharp from 'sharp'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

/**
 * Image processing utilities for supplement scanning
 * Handles compression, optimization, and format conversion
 */

export interface ImageProcessingOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

export interface ProcessedImage {
  buffer: Buffer
  metadata: {
    width: number
    height: number
    format: string
    size: number
  }
  filename: string
}

/**
 * Process and optimize uploaded image for OCR
 */
export async function processImageForOCR(
  fileBuffer: Buffer,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 85,
    format = 'jpeg'
  } = options

  try {
    // Process image for better OCR results
    const processedBuffer = await sharp(fileBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .normalize() // Enhance contrast
      .sharpen() // Improve text clarity
      .toFormat(format, { quality })
      .toBuffer()

    // Get processed metadata
    const processedMetadata = await sharp(processedBuffer).metadata()
    
    const filename = `processed_${randomUUID()}.${format}`
    
    return {
      buffer: processedBuffer,
      metadata: {
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0,
        format: processedMetadata.format || format,
        size: processedBuffer.length
      },
      filename
    }
  } catch (error) {
    throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Save image to public uploads directory
 */
export async function saveImageToUploads(
  buffer: Buffer,
  filename: string,
  uploadsDir: string = 'public/uploads'
): Promise<string> {
  try {
    // Ensure uploads directory exists
    await fs.mkdir(uploadsDir, { recursive: true })
    
    const filePath = path.join(uploadsDir, filename)
    await fs.writeFile(filePath, buffer)
    
    // Return public URL path
    return `/uploads/${filename}`
  } catch (error) {
    throw new Error(`Failed to save image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Validate image file
 */
export function validateImageFile(file: { size: number; type: string }): { valid: boolean; error?: string } {
  // Check file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File size must be less than 10MB' }
  }
  
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Only JPEG, PNG, and WebP images are allowed' }
  }
  
  return { valid: true }
}

/**
 * Generate unique filename with timestamp
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const randomId = randomUUID().slice(0, 8)
  const extension = path.extname(originalName)
  const baseName = path.basename(originalName, extension)
  
  return `${baseName}_${timestamp}_${randomId}${extension}`
}

/**
 * Clean up old uploaded files (for maintenance)
 */
export async function cleanupOldFiles(
  uploadsDir: string = 'public/uploads',
  maxAgeHours: number = 24
): Promise<void> {
  try {
    const files = await fs.readdir(uploadsDir)
    const now = Date.now()
    const maxAge = maxAgeHours * 60 * 60 * 1000 // Convert to milliseconds
    
    for (const file of files) {
      const filePath = path.join(uploadsDir, file)
      const stats = await fs.stat(filePath)
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath)
        console.log(`Cleaned up old file: ${file}`)
      }
    }
  } catch (error) {
    console.error('File cleanup failed:', error)
  }
}

/**
 * Get image metadata without processing
 */
export async function getImageMetadata(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer).metadata()
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      hasAlpha: metadata.hasAlpha,
      density: metadata.density,
      channels: metadata.channels
    }
  } catch (error) {
    throw new Error(`Failed to read image metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
