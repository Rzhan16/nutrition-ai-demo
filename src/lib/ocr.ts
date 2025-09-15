import Tesseract from 'tesseract.js';

/**
 * OCR Service for Supplement Label Reading
 * Implements complete OCR system with image preprocessing and text parsing
 */

export interface OCRResult {
  text: string;
  confidence: number;
  ingredients: ParsedIngredient[];
  servingSize?: string;
  brand?: string;
  productName?: string;
  nutritionFacts?: NutritionFacts;
  warnings?: string[];
  processingTime: number;
}

export interface ParsedIngredient {
  name: string;
  amount?: string;
  unit?: string;
  dailyValue?: string;
  description?: string;
}

export interface NutritionFacts {
  servingSize: string;
  servingsPerContainer?: string;
  calories?: string;
  nutrients: ParsedIngredient[];
}

export interface ImageEnhancementOptions {
  autoRotate?: boolean;
  enhanceContrast?: boolean;
  reduceNoise?: boolean;
  detectTextRegions?: boolean;
}

export class OCRService {
  private worker: Tesseract.Worker | null = null;
  private isInitialized = false;

  /**
   * Initialize Tesseract worker
   */
  private async initializeWorker(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      // Optimize for supplement labels
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()%- :',
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw new Error('OCR initialization failed');
    }
  }

  /**
   * Process image and extract supplement information
   */
  async processImage(imageFile: File): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      await this.initializeWorker();
      
      if (!this.worker) {
        throw new Error('OCR worker not initialized');
      }

      // Enhance image before OCR
      const enhancedFile = await this.enhanceImage(imageFile);
      
      // Perform OCR
      const result = await this.worker.recognize(enhancedFile);
      const rawText = result.data.text;
      const confidence = result.data.confidence;

      console.log('Raw OCR Text:', rawText);
      console.log('OCR Confidence:', confidence);

      // Parse extracted text
      const ingredients = await this.extractIngredients(rawText);
      const servingSize = this.extractServingSize(rawText);
      const brand = this.extractBrandName(rawText);
      const productName = this.extractProductName(rawText);
      const nutritionFacts = this.parseNutritionFacts(rawText);
      const warnings = this.extractWarnings(rawText);

      const processingTime = Date.now() - startTime;

      return {
        text: rawText,
        confidence,
        ingredients,
        servingSize,
        brand,
        productName,
        nutritionFacts,
        warnings,
        processingTime,
      };
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract ingredients from OCR text
   */
  async extractIngredients(text: string): Promise<ParsedIngredient[]> {
    const ingredients: ParsedIngredient[] = [];
    
    // Pattern to match ingredients section
    const ingredientsSection = this.extractSection(text, [
      'ingredients',
      'ingredient list',
      'contains',
      'active ingredients',
      'supplement facts'
    ]);

    if (!ingredientsSection) return ingredients;

    // Common supplement ingredient patterns
    const patterns = [
      // "Vitamin D3 (as cholecalciferol) 1000 IU (250% DV)"
      /([A-Za-z\s\d\-]+)\s*\(([^)]+)\)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*\((\d+%)\s*DV\)/gi,
      // "Magnesium 400mg"
      /([A-Za-z\s\d\-]+)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|IU)/gi,
      // "Vitamin C: 500mg (556% Daily Value)"
      /([A-Za-z\s\d\-]+):\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g|iu|IU)\s*\((\d+%)\s*(?:Daily\s*Value|DV)\)/gi,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(ingredientsSection)) !== null) {
        const [, name, amount, unit, dailyValue] = match;
        
        ingredients.push({
          name: name.trim(),
          amount: amount?.trim(),
          unit: unit?.toLowerCase(),
          dailyValue: dailyValue?.trim(),
        });
      }
    });

    // Remove duplicates
    return this.removeDuplicateIngredients(ingredients);
  }

  /**
   * Enhance image for better OCR accuracy
   */
  async enhanceImage(imageFile: File, options: ImageEnhancementOptions = {}): Promise<File> {
    const {
      autoRotate = true,
      enhanceContrast = true,
      reduceNoise = true,
    } = options;

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          canvas.width = img.width;
          canvas.height = img.height;

          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // Draw original image
          ctx.drawImage(img, 0, 0);

          // Get image data for processing
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Enhance contrast
          if (enhanceContrast) {
            this.enhanceContrast(data);
          }

          // Reduce noise (simple smoothing)
          if (reduceNoise) {
            this.reduceNoise(data, canvas.width, canvas.height);
          }

          // Convert to grayscale for better OCR
          this.convertToGrayscale(data);

          // Put processed data back
          ctx.putImageData(imageData, 0, 0);

          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (blob) {
              const enhancedFile = new File([blob], imageFile.name, {
                type: 'image/png'
              });
              resolve(enhancedFile);
            } else {
              reject(new Error('Failed to create enhanced image'));
            }
          }, 'image/png');

        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(imageFile);
    });
  }

  /**
   * Parse nutrition facts from text
   */
  private parseNutritionFacts(text: string): NutritionFacts | undefined {
    const factsSection = this.extractSection(text, [
      'nutrition facts',
      'supplement facts',
      'nutritional information'
    ]);

    if (!factsSection) return undefined;

    const servingSizeMatch = factsSection.match(/serving\s*size[:\s]*([^(\n]*)/i);
    const servingsPerContainerMatch = factsSection.match(/servings?\s*per\s*container[:\s]*(\d+)/i);
    const caloriesMatch = factsSection.match(/calories[:\s]*(\d+)/i);

    return {
      servingSize: servingSizeMatch?.[1]?.trim() || '',
      servingsPerContainer: servingsPerContainerMatch?.[1]?.trim(),
      calories: caloriesMatch?.[1]?.trim(),
      nutrients: [], // Will be populated by extractIngredients
    };
  }

  /**
   * Extract serving size from text
   */
  private extractServingSize(text: string): string | undefined {
    const patterns = [
      /serving\s*size[:\s]*([^(\n]*)/i,
      /(\d+)\s*(capsule|tablet|softgel|gummies|scoop)/i,
      /take\s*(\d+[^(\n]*)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract brand name from text
   */
  private extractBrandName(text: string): string | undefined {
    // Common supplement brands
    const knownBrands = [
      'Pure Encapsulations', 'Thorne', 'Life Extension', 'NOW Foods',
      'Nature Made', 'Centrum', 'Garden of Life', 'Nordic Naturals',
      'New Chapter', 'Rainbow Light', 'Solgar', 'Nature\'s Bounty',
      'Jarrow Formulas', 'Doctor\'s Best', 'Source Naturals'
    ];

    const upperText = text.toUpperCase();
    
    for (const brand of knownBrands) {
      if (upperText.includes(brand.toUpperCase())) {
        return brand;
      }
    }

    // Try to extract from first lines (brands often appear at top)
    const lines = text.split('\n').slice(0, 3);
    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned.length > 2 && cleaned.length < 30 && /^[A-Za-z\s&'.]+$/.test(cleaned)) {
        return cleaned;
      }
    }

    return undefined;
  }

  /**
   * Extract product name from text
   */
  private extractProductName(text: string): string | undefined {
    const lines = text.split('\n');
    
    // Look for product name in first few lines
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      
      // Skip if it's likely a brand name or very short
      if (line.length < 3 || line.length > 50) continue;
      
      // Look for supplement-related keywords
      if (/vitamin|mineral|supplement|complex|formula|extract|acid|protein/i.test(line)) {
        return line;
      }
    }

    return undefined;
  }

  /**
   * Extract warnings and allergen information
   */
  private extractWarnings(text: string): string[] {
    const warnings: string[] = [];
    const warningSection = this.extractSection(text, [
      'warning', 'warnings', 'caution', 'contains', 'allergens',
      'keep out of reach', 'consult your physician'
    ]);

    if (warningSection) {
      const warningLines = warningSection.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 10);
      
      warnings.push(...warningLines);
    }

    return warnings;
  }

  /**
   * Extract section from text based on keywords
   */
  private extractSection(text: string, keywords: string[]): string | null {
    const lowerText = text.toLowerCase();
    
    for (const keyword of keywords) {
      const index = lowerText.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        // Extract from keyword to end or next major section
        const section = text.substring(index);
        const endIndex = section.search(/\n\s*\n|\n[A-Z][A-Z]/);
        return endIndex > 0 ? section.substring(0, endIndex) : section;
      }
    }
    
    return null;
  }

  /**
   * Remove duplicate ingredients
   */
  private removeDuplicateIngredients(ingredients: ParsedIngredient[]): ParsedIngredient[] {
    const seen = new Set<string>();
    return ingredients.filter(ingredient => {
      const key = ingredient.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Enhance image contrast
   */
  private enhanceContrast(data: Uint8ClampedArray): void {
    const factor = 1.2; // Contrast factor
    const intercept = 128 * (1 - factor);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] * factor + intercept));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor + intercept)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor + intercept)); // B
    }
  }

  /**
   * Reduce image noise
   */
  private reduceNoise(data: Uint8ClampedArray, width: number, height: number): void {
    // Simple noise reduction using moving average
    const originalData = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        // Average with surrounding pixels
        let r = 0, g = 0, b = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
            r += originalData[neighborIdx];
            g += originalData[neighborIdx + 1];
            b += originalData[neighborIdx + 2];
          }
        }
        
        data[idx] = r / 9;
        data[idx + 1] = g / 9;
        data[idx + 2] = b / 9;
      }
    }
  }

  /**
   * Convert image to grayscale
   */
  private convertToGrayscale(data: Uint8ClampedArray): void {
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;     // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const ocrService = new OCRService(); 