// Core Types
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

export interface Scan {
  id: string;
  supplementId?: string;
  imageUrl: string;
  ocrText?: string;
  analysis?: AnalysisResponse;
  userId?: string;
  createdAt: Date;
}

// AI Analysis Types
export interface AnalysisRequest {
  supplementName: string;
  brand: string;
  ingredients: ParsedIngredient[];
  servingSize: string;
  userProfile?: UserProfile;
}

export interface AnalysisResponse {
  basicIntroduction: string;
  primaryBenefits: Benefit[];
  recommendedDosage: DosageInfo;
  upperLimit: SafetyLimit;
  dietarySources: string[];
  supplementForms: SupplementForm[];
  suitableConditions: string[];
  risksAndPrecautions: Warning[];
  references: Reference[];
  confidence: number;
}

export interface Benefit {
  title: string;
  description: string;
  evidenceLevel: 'High' | 'Moderate' | 'Limited';
  studies?: string[];
}

export interface DosageInfo {
  adults: string;
  olderAdults?: string;
  specialPopulations?: Record<string, string>;
}

export interface SafetyLimit {
  adults: string;
  warnings: string[];
  overdoseSymptoms: string[];
}

export interface SupplementForm {
  name: string;
  absorptionRate: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
}

export interface Warning {
  type: 'interaction' | 'condition' | 'side-effect' | 'general';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedMedications?: string[];
  affectedConditions?: string[];
}

export interface Reference {
  title: string;
  authors: string;
  year: number;
  journal?: string;
  url?: string;
  type: 'study' | 'guideline' | 'database';
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
  category: 'fitness' | 'immunity' | 'stress' | 'digestion' | 'inflammation' | 'skin' | 'general';
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

// OCR Types
export interface OCRResult {
  text: string;
  confidence: number;
  ingredients: ParsedIngredient[];
  servingSize?: string;
  brand?: string;
  productName?: string;
  processingTime: number;
}

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

// UI Component Types
export interface FileUploadProps {
  onUpload: (file: File) => void;
  maxSize?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
  className?: string;
}

export interface SearchProps {
  onSearch: (query: string) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  userFriendly: boolean;
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

export type SupplementCategory = typeof SUPPLEMENT_CATEGORIES[number];
export type SupplementBrand = typeof POPULAR_BRANDS[number];

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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
  scanId: string;
  supplementId?: string;
  cached: boolean;
  ocrConfidence?: number;
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
  scans: Array<Scan & {
    supplement?: {
      id: string;
      name: string;
      brand: string;
      category: string;
    };
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
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
  details?: any;
  statusCode: number;
} 