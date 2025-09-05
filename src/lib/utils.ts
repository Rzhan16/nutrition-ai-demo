import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate file type
 */
export function isValidFileType(file: File, acceptedTypes: string[]): boolean {
  return acceptedTypes.some(type => {
    if (type.startsWith('.')) {
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    }
    return file.type.match(type.replace('*', '.*'));
  });
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Format time for display
 */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Calculate days between dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

/**
 * Generate browser fingerprint for user identification
 */
export function generateBrowserFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx!.textBaseline = 'top';
  ctx!.font = '14px Arial';
  ctx!.fillText('Browser fingerprint', 2, 2);

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
    canvas.toDataURL(),
  ].join('|');

  return btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Extract numbers from text
 */
export function extractNumbers(text: string): number[] {
  const numberRegex = /\d+\.?\d*/g;
  const matches = text.match(numberRegex);
  return matches ? matches.map(Number) : [];
}

/**
 * Extract dosage information from text
 */
export function extractDosage(text: string): { amount: number; unit: string } | null {
  const dosageRegex = /(\d+\.?\d*)\s*(mg|g|mcg|μg|iu|iu|capsules?|tablets?|ml|oz)/i;
  const match = text.match(dosageRegex);
  
  if (match) {
    return {
      amount: parseFloat(match[1]),
      unit: match[2].toLowerCase(),
    };
  }
  
  return null;
}

/**
 * Clean and normalize text
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,()-]/g, '')
    .toLowerCase();
}

/**
 * Calculate confidence score
 */
export function calculateConfidence(
  ocrConfidence: number,
  textLength: number,
  ingredientCount: number
): number {
  const baseScore = ocrConfidence;
  const lengthBonus = Math.min(textLength / 100, 0.1);
  const ingredientBonus = Math.min(ingredientCount / 10, 0.1);
  
  return Math.min(baseScore + lengthBonus + ingredientBonus, 1);
}

/**
 * Format API error message
 */
export function formatApiError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  if (error && typeof error === 'object' && 'error' in error && typeof error.error === 'string') {
    return error.error;
  }
  return 'An unexpected error occurred';
}

/**
 * Validate supplement data
 */
export function validateSupplementData(data: Record<string, unknown>): boolean {
  const required = ['name', 'brand', 'ingredients'];
  return required.every(field => 
    data[field] && 
    ((typeof data[field] === 'string' && data[field].length > 0) ||
     (Array.isArray(data[field]) && data[field].length > 0))
  );
}

/**
 * Convert weight units
 */
export function convertWeight(value: number, from: 'kg' | 'lbs', to: 'kg' | 'lbs'): number {
  if (from === to) return value;
  if (from === 'kg' && to === 'lbs') return value * 2.20462;
  if (from === 'lbs' && to === 'kg') return value / 2.20462;
  return value;
}

/**
 * Convert height units
 */
export function convertHeight(value: number, from: 'cm' | 'ft', to: 'cm' | 'ft'): number {
  if (from === to) return value;
  if (from === 'cm' && to === 'ft') return value / 30.48;
  if (from === 'ft' && to === 'cm') return value * 30.48;
  return value;
}

/**
 * Calculate BMI
 */
export function calculateBMI(weight: number, height: number, weightUnit: 'kg' | 'lbs', heightUnit: 'cm' | 'ft'): number {
  const weightKg = convertWeight(weight, weightUnit, 'kg');
  const heightM = convertHeight(height, heightUnit, 'cm') / 100;
  return weightKg / (heightM * heightM);
}

/**
 * Get BMI category
 */
export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal weight';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

/**
 * Sleep function for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Check if running on client side
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Check if running on server side
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(key: string, fallback: string = ''): string {
  if (isServer()) {
    return process.env[key] || fallback;
  }
  return fallback;
} 