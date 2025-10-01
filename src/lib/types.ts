// Core Domain Types
export interface Supplement {
  id: string;
  name: string;
  brand: string;
  category: string;
  ingredients: ParsedIngredient[];
  imageUrl?: string;
  verified: boolean;
  createdAt: Date;
  scans?: Scan[];
  _count?: {
    scans: number;
  };
  relevanceScore?: number;
}

export interface ParsedIngredient {
  name: string;
  amount?: string;
  unit?: string;
  dailyValue?: string;
  description?: string;
}

export interface NutritionFacts {
  servingSize?: string;
  servingsPerContainer?: string;
  calories?: string;
  nutrients?: ParsedIngredient[];
}

export interface Scan {
  id: string;
  supplementId?: string;
  imageUrl: string;
  ocrText?: string;
  analysis?: AnalysisResponse;
  userId?: string;
  createdAt: Date;
}

export interface AnalysisRequest {
  supplementName: string;
  brand: string;
  ingredients: ParsedIngredient[];
  servingSize: string;
  userProfile?: UserProfile;
}

export interface AnalysisResponse {
  supplementName: string;
  brand?: string;
  confidence: number;
  analysis: {
    basicIntroduction: string;
    primaryBenefits: string;
    rdaGuidelines: string;
    safetyLimits: string;
    dietarySources: string;
    supplementForms: string;
    usageScenarios: string;
    risksPrecautions: string;
  };
  ingredients: Array<{
    name: string;
    amount: string;
    unit: string;
    dailyValue?: number;
  }>;
  warnings?: string[];
  recommendations?: string[];
  references?: string[];
  scanId: string;
  supplementId?: string;
  cached: boolean;
  ocrConfidence?: number;
  analysisMethod?: string;
  sources?: string[];
}

export interface UploadResponse {
  imageUrl: string;
  filename: string;
  metadata: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
  originalName: string;
  uploadedAt: string;
}

// Barcode Types
export const BARCODE_ENGINE_VALUES = ['quagga', 'zxing', 'html5-qrcode'] as const;
export type BarcodeEngine = (typeof BARCODE_ENGINE_VALUES)[number];

export const BARCODE_ENGINE_OPTIONS = ['auto', ...BARCODE_ENGINE_VALUES] as const;
export type BarcodeEngineOption = (typeof BARCODE_ENGINE_OPTIONS)[number];

export const BARCODE_FORMATS = ['EAN13', 'EAN8', 'UPC', 'UPCE', 'CODE128', 'CODE39'] as const;
export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

export type BarcodeErrorCode =
  | 'barcode_failed'
  | 'barcode_timeout'
  | 'camera_permission_denied'
  | 'camera_not_found'
  | 'barcode_unsupported'
  | 'not_allowed'
  | 'not_found'
  | 'unsupported'
  | 'timeout'
  | 'other'
  | 'analyze_failed'
  | 'search_failed';

export interface BarcodeProductInfo {
  name?: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  upc?: string;
  ean?: string;
  description?: string;
  ingredients?: string[];
  nutrition?: Record<string, unknown>;
  warnings?: string[];
}

export interface BarcodeScanResult {
  ok: boolean;
  code?: string;
  format?: BarcodeFormat | string;
  confidence?: number;
  durationMs: number;
  framesTried?: number;
  engine: BarcodeEngine;
  symbology?: string;
  errorCode?: BarcodeErrorCode;
  errorMessage?: string;
  rawValue?: unknown;
  productInfo?: BarcodeProductInfo;
  timestamp?: number;
}

// OCR Types
export interface OCRBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox?: OCRBoundingBox;
}

export type OCRErrorCode = 'ocr_failed' | 'ocr_low_confidence' | 'ocr_timeout' | 'ocr_aborted' | 'analyze_failed' | 'search_failed';

export interface OCRResult {
  ok: boolean;
  text: string;
  confidence: number;
  durationMs: number;
  words?: OCRWord[];
  bbox?: OCRBoundingBox[];
  wasAborted?: boolean;
  errorCode?: OCRErrorCode;
  errorMessage?: string;
  raw?: unknown;
  barcode?: string;
  ingredients?: ParsedIngredient[];
  servingSize?: string;
  brand?: string;
  productName?: string;
  nutritionFacts?: NutritionFacts;
  warnings?: string[];
  processingTime?: number;
  qualityMetrics?: {
    confidence: number;
    wordCount: number;
    avgWordConfidence: number;
    textLength: number;
    hasNutritionKeywords: boolean;
    hasNumericData: boolean;
    qualityScore: number;
  };
}

export const SMART_SCAN_STEPS = [
  'idle',
  'scanning_barcode',
  'ocr',
  'manual_correction',
  'analyzing',
  'searching',
  'done',
  'error',
] as const;
export type SmartScanStep = (typeof SMART_SCAN_STEPS)[number];

export const SMART_SCAN_EVENTS = [
  'START',
  'BARCODE_SUCCEEDED',
  'BARCODE_FAILED',
  'BARCODE_TIMEOUT',
  'OCR_SUCCEEDED',
  'OCR_LOW_CONFIDENCE',
  'OCR_FAILED',
  'ANALYZE_RESOLVED',
  'ANALYZE_FAILED',
  'RESET',
  'CANCEL',
] as const;
export type SmartScanEventType = (typeof SMART_SCAN_EVENTS)[number];

export type ScanSource = 'camera' | 'image';

// Search Types
export interface SearchFilters {
  category?: string[];
  brand?: string[];
  priceRange?: [number, number];
  rating?: number;
  verified?: boolean;
  ingredients?: string[];
}

export interface SearchResult {
  supplements: Supplement[];
  totalCount: number;
  suggestions: string[];
  categories: CategoryCount[];
  facets: SearchFacets;
  searchTime: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface SearchFacets {
  brands: FacetCount[];
  categories: FacetCount[];
  priceRanges: FacetCount[];
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface SearchResponse {
  supplements: Supplement[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  suggestions: {
    categories: string[];
    brands: string[];
    popularSearches: string[];
  };
  searchMeta: {
    query: string;
    filters: {
      category?: string;
      brand?: string;
    };
    resultCount: number;
  };
}

export interface ScanHistoryResponse {
  scans: Array<
    Scan & {
      supplement?: {
        id: string;
        name: string;
        brand: string;
        category: string;
      };
    }
  >;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// API Response Types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Rate Limiting Types
export interface RateLimitInfo {
  remaining: number;
  resetTime: number;
}

// Error Types
export interface APIError {
  code: string;
  message: string;
  details?: unknown;
  statusCode: number;
}

// User Types
export interface UserProfile {
  id: string;
  fingerprint: string;
  demographics: Demographics;
  healthGoals: HealthGoal[];
  dietaryRestrictions: string[];
  currentSupplements: CurrentSupplement[];
  activityLevel: ActivityLevel;
  location: Location;
  preferences: UserPreferences;
}

export interface Demographics {
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  weight?: number;
  height?: number;
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'ft';
}

export interface HealthGoal {
  id: string;
  category:
    | 'fitness'
    | 'immunity'
    | 'stress'
    | 'digestion'
    | 'inflammation'
    | 'skin'
    | 'general';
  description: string;
  priority: 'low' | 'medium' | 'high';
  targetDate?: Date;
}

export interface CurrentSupplement {
  supplementId: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  effectiveness?: number; // 1-5 scale
  sideEffects?: string[];
}

export interface ActivityLevel {
  type: 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
  exerciseType?: string[];
  hoursPerWeek?: number;
}

export interface Location {
  country: string;
  region?: string;
  timezone?: string;
  sunlightHours?: number; // Average daily sunlight exposure
}

export interface UserPreferences {
  language: 'en' | 'zh' | 'bilingual';
  units: 'metric' | 'imperial';
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  budget?: BudgetPreferences;
}

export interface NotificationPreferences {
  reminders: boolean;
  effectiveness: boolean;
  research: boolean;
  priceDrops: boolean;
  interactions: boolean;
}

export interface PrivacyPreferences {
  analytics: boolean;
  personalization: boolean;
  thirdParty: boolean;
}

export interface BudgetPreferences {
  maxMonthly?: number;
  currency: string;
  priorityCategories: string[];
}

// Tracking Types
export interface LoginTracking {
  dailyLogins: number;
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
  lastLogin: Date;
  supplementCompliance: ComplianceMetrics;
}

export interface ComplianceMetrics {
  totalSupplements: number;
  takenToday: number;
  weeklyAverage: number;
  monthlyAverage: number;
  streakDays: number;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

// Constants
export const SUPPLEMENT_CATEGORIES = [
  'vitamins',
  'minerals',
  'amino-acids',
  'probiotics',
  'omega-3',
  'herbs',
  'antioxidants',
  'protein',
  'energy',
  'immune',
  'digestive',
  'cognitive',
  'sleep',
  'joint',
  'heart',
  'multivitamin',
] as const;

export const POPULAR_BRANDS = [
  'Pure Encapsulations',
  'Thorne',
  'Life Extension',
  'NOW Foods',
  'Garden of Life',
  'Nordic Naturals',
  'Solgar',
  'Nature Made',
  'Rainbow Light',
  'New Chapter',
] as const;

export type SupplementCategory = (typeof SUPPLEMENT_CATEGORIES)[number];
export type SupplementBrand = (typeof POPULAR_BRANDS)[number];
