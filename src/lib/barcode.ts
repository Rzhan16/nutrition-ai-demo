import Quagga from 'quagga';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

/**
 * Barcode Scanning Service for Supplement Identification
 * Supports multiple barcode formats including UPC, EAN, Code128, QR codes
 */

export interface BarcodeResult {
  code: string;
  format: string;
  confidence: number;
  productInfo?: ProductInfo;
  timestamp: number;
}

export interface ProductInfo {
  name?: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  upc?: string;
  ean?: string;
  description?: string;
  ingredients?: string[];
  nutrition?: any;
  warnings?: string[];
}

export interface BarcodeScannerConfig {
  target: string | HTMLElement;
  formats: string[];
  enableCamera: boolean;
  enableFlash: boolean;
  localization: 'x-small' | 'small' | 'medium' | 'large' | 'x-large';
  frequency: number;
}

export class BarcodeService {
  private quaggaInitialized = false;
  private html5QrScanner: Html5QrcodeScanner | null = null;
  private currentStream: MediaStream | null = null;

  /**
   * Check if we're in browser environment
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  /**
   * Wait for DOM element to be available
   */
  private async waitForElement(selector: string, timeout = 5000): Promise<HTMLElement | null> {
    if (!this.isBrowser()) return null;

    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = typeof selector === 'string' 
          ? document.querySelector(selector) as HTMLElement
          : selector as HTMLElement;
          
        if (element) {
          resolve(element);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          resolve(null);
          return;
        }
        
        setTimeout(checkElement, 100);
      };
      
      checkElement();
    });
  }

  /**
   * Initialize barcode scanner with better error handling
   */
  async initializeScanner(config: Partial<BarcodeScannerConfig> = {}): Promise<void> {
    if (!this.isBrowser()) {
      throw new Error('Barcode scanner only works in browser environment');
    }

    const defaultConfig: BarcodeScannerConfig = {
      target: '#barcode-scanner',
      formats: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader'],
      enableCamera: true,
      enableFlash: false,
      localization: 'medium',
      frequency: 10,
      ...config
    };

    try {
      // Wait for target element to be available
      const targetElement = await this.waitForElement(defaultConfig.target as string);
      if (!targetElement) {
        throw new Error(`Target element '${defaultConfig.target}' not found in DOM`);
      }

      await this.initializeQuagga(defaultConfig);
      this.quaggaInitialized = true;
    } catch (error) {
      console.error('Failed to initialize barcode scanner:', error);
      throw new Error(`Barcode scanner initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize Quagga for barcode scanning with DOM safety checks
   */
  private async initializeQuagga(config: BarcodeScannerConfig): Promise<void> {
    if (!this.isBrowser()) {
      throw new Error('Cannot initialize Quagga outside browser environment');
    }

    return new Promise((resolve, reject) => {
      try {
        // Ensure target element exists
        const targetElement = typeof config.target === 'string' 
          ? document.querySelector(config.target) as HTMLElement
          : config.target as HTMLElement;

        if (!targetElement) {
          reject(new Error(`Target element not found: ${config.target}`));
          return;
        }

        const quaggaConfig = {
          inputStream: {
            name: 'Live',
            type: 'LiveStream',
            target: targetElement,
            constraints: {
              width: 640,
              height: 480,
              facingMode: 'environment' // Use back camera
            }
          },
          locator: {
            patchSize: config.localization,
            halfSample: true
          },
          numOfWorkers: 2, // Reduced from 4 for better compatibility
          frequency: config.frequency,
          decoder: {
            readers: config.formats
          },
          locate: true
        };

        Quagga.init(quaggaConfig, (err: any) => {
          if (err) {
            console.error('Quagga initialization error:', err);
            reject(new Error(`Quagga initialization failed: ${err.message || err}`));
            return;
          }
          
          console.log('Quagga initialized successfully');
          
          try {
            Quagga.start();
            resolve();
          } catch (startError) {
            reject(new Error(`Failed to start Quagga: ${startError}`));
          }
        });
      } catch (error) {
        reject(new Error(`Quagga setup error: ${error}`));
      }
    });
  }

  /**
   * Start barcode scanning with enhanced error handling
   */
  async startScanning(
    onDetected: (result: BarcodeResult) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (!this.isBrowser()) {
      const error = new Error('Barcode scanning only works in browser environment');
      onError?.(error);
      return;
    }

    if (!this.quaggaInitialized) {
      const error = new Error('Scanner not initialized. Call initializeScanner() first.');
      onError?.(error);
      return;
    }

    try {
      // Set up barcode detection handler
      Quagga.onDetected((result: any) => {
        try {
          const barcodeResult: BarcodeResult = {
            code: result.codeResult.code,
            format: result.codeResult.format,
            confidence: this.calculateConfidence(result),
            timestamp: Date.now()
          };

          console.log('Barcode detected:', barcodeResult);

          // Only process high-confidence results
          if (barcodeResult.confidence > 0.7) {
            this.lookupProductInfo(barcodeResult.code)
              .then(productInfo => {
                barcodeResult.productInfo = productInfo;
                onDetected(barcodeResult);
              })
              .catch(error => {
                console.warn('Product lookup failed:', error);
                onDetected(barcodeResult); // Return barcode without product info
              });
          }
        } catch (error) {
          console.error('Error processing barcode:', error);
          onError?.(error as Error);
        }
      });

      // Set up processing handler with error handling
      Quagga.onProcessed((result: any) => {
        try {
          if (result && result.boxes) {
            // Draw detection boxes for debugging
            this.drawDetectionBoxes(result.boxes);
          }
        } catch (error) {
          console.warn('Error in processing handler:', error);
        }
      });
    } catch (error) {
      console.error('Error setting up barcode scanning:', error);
      onError?.(error as Error);
    }
  }

  /**
   * Stop barcode scanning with cleanup
   */
  stopScanning(): void {
    try {
      if (this.quaggaInitialized) {
        Quagga.stop();
        this.quaggaInitialized = false;
      }

      if (this.html5QrScanner) {
        this.html5QrScanner.clear();
        this.html5QrScanner = null;
      }

      if (this.currentStream) {
        this.currentStream.getTracks().forEach(track => track.stop());
        this.currentStream = null;
      }
    } catch (error) {
      console.warn('Error during scanner cleanup:', error);
    }
  }

  /**
   * Initialize QR code scanner (alternative to Quagga)
   */
  async initializeQRScanner(
    elementId: string,
    onSuccess: (decodedText: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.isBrowser()) {
      onError('QR scanner only works in browser environment');
      return;
    }

    try {
      // Wait for element to be available
      const element = await this.waitForElement(`#${elementId}`);
      if (!element) {
        throw new Error(`QR scanner element '${elementId}' not found`);
      }

      this.html5QrScanner = new Html5QrcodeScanner(
        elementId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        },
        false
      );

      this.html5QrScanner.render(
        (decodedText) => {
          console.log('QR Code detected:', decodedText);
          onSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore frequent scanning errors
          if (!errorMessage.includes('No QR code found')) {
            console.warn('QR Scanner error:', errorMessage);
            onError(errorMessage);
          }
        }
      );
    } catch (error) {
      console.error('QR Scanner initialization failed:', error);
      onError(error instanceof Error ? error.message : 'QR scanner initialization failed');
    }
  }

  /**
   * Scan barcode from uploaded image with better error handling
   */
  async scanFromImage(imageFile: File): Promise<BarcodeResult[]> {
    if (!this.isBrowser()) {
      throw new Error('Image scanning only works in browser environment');
    }

    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        img.onload = () => {
          try {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // Use Quagga to decode from canvas
            Quagga.decodeSingle({
              inputStream: {
                name: 'File',
                type: 'ImageStream',
                target: canvas,
                constraints: {
                  width: img.width,
                  height: img.height
                }
              },
              locator: {
                patchSize: 'medium',
                halfSample: true
              },
              decoder: {
                readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader']
              },
              locate: true
            }, (result: any) => {
              try {
                if (result && result.codeResult) {
                  const barcodeResult: BarcodeResult = {
                    code: result.codeResult.code,
                    format: result.codeResult.format,
                    confidence: this.calculateConfidence(result),
                    timestamp: Date.now()
                  };

                  this.lookupProductInfo(barcodeResult.code)
                    .then(productInfo => {
                      barcodeResult.productInfo = productInfo;
                      resolve([barcodeResult]);
                    })
                    .catch(() => {
                      resolve([barcodeResult]);
                    });
                } else {
                  resolve([]);
                }
              } catch (decodeError) {
                console.error('Error processing decoded result:', decodeError);
                resolve([]);
              }
            });
          } catch (canvasError) {
            reject(new Error(`Canvas processing failed: ${canvasError}`));
          }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        
        try {
          img.src = URL.createObjectURL(imageFile);
        } catch (urlError) {
          reject(new Error(`Failed to create image URL: ${urlError}`));
        }
      } catch (error) {
        reject(new Error(`Image scanning setup failed: ${error}`));
      }
    });
  }

  /**
   * Lookup product information by barcode
   */
  private async lookupProductInfo(barcode: string): Promise<ProductInfo | undefined> {
    try {
      // Try multiple product databases
      const sources = [
        this.lookupOpenFoodFacts(barcode),
        this.lookupUPCDatabase(barcode),
        this.lookupLocalDatabase(barcode)
      ];

      // Return first successful lookup
      const results = await Promise.allSettled(sources);
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          return result.value;
        }
      }

      return undefined;
    } catch (error) {
      console.error('Product lookup failed:', error);
      return undefined;
    }
  }

  /**
   * Lookup product in Open Food Facts database
   */
  private async lookupOpenFoodFacts(barcode: string): Promise<ProductInfo | undefined> {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();

      if (data.status === 1 && data.product) {
        const product = data.product;
        return {
          name: product.product_name,
          brand: product.brands,
          category: product.categories,
          imageUrl: product.image_url,
          upc: barcode,
          description: product.generic_name,
          ingredients: product.ingredients_text?.split(', '),
          nutrition: product.nutriments,
          warnings: product.allergens_tags
        };
      }

      return undefined;
    } catch (error) {
      console.error('Open Food Facts lookup failed:', error);
      return undefined;
    }
  }

  /**
   * Lookup product in UPC database
   */
  private async lookupUPCDatabase(barcode: string): Promise<ProductInfo | undefined> {
    try {
      // This would require an API key for most UPC databases
      // For demo purposes, return undefined
      console.log('UPC database lookup not implemented (requires API key)');
      return undefined;
    } catch (error) {
      console.error('UPC database lookup failed:', error);
      return undefined;
    }
  }

  /**
   * Lookup product in local database
   */
  private async lookupLocalDatabase(barcode: string): Promise<ProductInfo | undefined> {
    try {
      // Search local supplement database by UPC/EAN
      const response = await fetch(`/api/search?upc=${encodeURIComponent(barcode)}`);
      const data = await response.json();

      if (data.success && data.data.supplements.length > 0) {
        const supplement = data.data.supplements[0];
        return {
          name: supplement.name,
          brand: supplement.brand,
          category: supplement.category,
          imageUrl: supplement.imageUrl,
          upc: barcode,
          ingredients: supplement.ingredients?.map((ing: any) => ing.name)
        };
      }

      return undefined;
    } catch (error) {
      console.error('Local database lookup failed:', error);
      return undefined;
    }
  }

  /**
   * Calculate confidence score from Quagga result
   */
  private calculateConfidence(result: any): number {
    if (!result.codeResult) return 0;

    // Average the confidence of all detected bars
    const boxes = result.boxes || [];
    if (boxes.length === 0) return 0.5;

    // Use the number of detected boxes as a confidence indicator
    const boxConfidence = Math.min(boxes.length / 10, 1);
    
    // Combine with code result confidence if available
    const codeConfidence = result.codeResult.decodedCodes?.length || 0.5;
    
    return (boxConfidence + codeConfidence) / 2;
  }

  /**
   * Draw detection boxes for debugging
   */
  private drawDetectionBoxes(boxes: any[]): void {
    if (!this.isBrowser()) return;

    try {
      const canvas = document.querySelector('#barcode-scanner canvas') as HTMLCanvasElement;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      boxes.forEach(box => {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(box[0].x, box[0].y);
        for (let i = 1; i < box.length; i++) {
          ctx.lineTo(box[i].x, box[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      });
    } catch (error) {
      console.warn('Error drawing detection boxes:', error);
    }
  }

  /**
   * Get available camera devices
   */
  async getCameraDevices(): Promise<MediaDeviceInfo[]> {
    if (!this.isBrowser()) return [];

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Failed to get camera devices:', error);
      return [];
    }
  }

  /**
   * Check if camera access is available
   */
  async checkCameraPermission(): Promise<boolean> {
    if (!this.isBrowser()) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Camera permission denied:', error);
      return false;
    }
  }

  /**
   * Validate barcode format
   */
  isValidBarcode(code: string, format: string): boolean {
    switch (format.toLowerCase()) {
      case 'ean_13':
      case 'ean-13':
        return /^\d{13}$/.test(code);
      case 'ean_8':
      case 'ean-8':
        return /^\d{8}$/.test(code);
      case 'upc_a':
      case 'upc-a':
        return /^\d{12}$/.test(code);
      case 'code_128':
      case 'code-128':
        return code.length >= 4 && code.length <= 20;
      case 'code_39':
      case 'code-39':
        return /^[A-Z0-9\-.\s$\/+%*]+$/.test(code);
      default:
        return code.length >= 4; // Generic validation
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopScanning();
  }
}

// Export singleton instance
export const barcodeService = new BarcodeService(); 