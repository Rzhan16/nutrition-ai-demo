/**
 * Optimized OCR Processor Component
 * 
 * Features:
 * - Enhanced service integration
 * - Better error handling and recovery
 * - Improved mobile performance
 * - Smart retry logic
 * - Quality assessment feedback
 * - Memory management
 * - Accessibility improvements
 */

'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  RotateCcw, 
  Zap, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Loader2,
  Gauge,
  RefreshCw,
  ImageIcon
} from 'lucide-react';
import type { OCRResult } from '@/lib/types';
import { barcodeService, BarcodeResult } from '@/lib/barcode';
import { enhancedOcrService, type EnhancedOcrOptions } from '@/lib/ocr/enhanced-service';

interface OptimizedOCRProcessorProps {
  onResult: (result: OCRResult | BarcodeResult) => void;
  onError: (error: string) => void;
  className?: string;
  enableBarcode?: boolean;
  qualityThreshold?: number;
  maxRetries?: number;
  enableAdvancedPreprocessing?: boolean;
}

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  stage: 'idle' | 'uploading' | 'preprocessing' | 'scanning_barcode' | 'extracting_text' | 'quality_check' | 'retry' | 'complete' | 'error';
  error?: string;
  status?: string;
  attempt?: number;
  maxAttempts?: number;
  quality?: {
    confidence: number;
    qualityScore: number;
    hasNutritionKeywords: boolean;
  };
}

const STAGE_DESCRIPTIONS = {
  idle: 'Ready to scan',
  uploading: 'Uploading image...',
  preprocessing: 'Optimizing image quality...',
  scanning_barcode: 'Scanning for barcode...',
  extracting_text: 'Extracting text with OCR...',
  quality_check: 'Assessing result quality...',
  retry: 'Retrying with enhanced settings...',
  complete: 'Processing complete!',
  error: 'Processing failed'
} as const;

export function OptimizedOCRProcessor({ 
  onResult, 
  onError, 
  className = '',
  enableBarcode = true,
  qualityThreshold = 0.75,
  maxRetries = 2,
  enableAdvancedPreprocessing = true
}: OptimizedOCRProcessorProps) {
  
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    stage: 'idle'
  });
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [detectedText, setDetectedText] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [manualEdit, setManualEdit] = useState<string>('');
  const [showManualEdit, setShowManualEdit] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<'barcode' | 'ocr' | 'both'>('both');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barcodeScannerRef = useRef<HTMLDivElement>(null);
  const frameLoopRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isUsingCamera, setIsUsingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');

  const stopCamera = useCallback(() => {
    try {
      if (frameLoopRef.current !== null) {
        cancelAnimationFrame(frameLoopRef.current);
        frameLoopRef.current = null;
      }

      const currentStream = streamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setIsUsingCamera(false);
      setCameraError('');

      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.srcObject = null;
        } catch (pauseError) {
          console.warn('Video pause failed:', pauseError);
        }
      }

      barcodeService.stopScanning();
    } catch (error) {
      console.warn('Error stopping camera:', error);
    }
  }, []);

  const cleanupResources = useCallback(() => {
    try {
      // Abort any ongoing processing
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Stop camera
      stopCamera();
      
      // Cleanup preview image
      if (previewImage) {
        URL.revokeObjectURL(previewImage);
      }
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }, [previewImage, stopCamera]);

  // Cleanup resources on unmount
  useEffect(() => () => cleanupResources(), [cleanupResources]);

  const updateProgress = useCallback((
    stage: ProcessingState['stage'], 
    progress: number, 
    status?: string,
    quality?: ProcessingState['quality']
  ) => {
    setProcessingState(prev => ({
      ...prev,
      stage,
      progress: Math.min(100, Math.max(0, progress)),
      status,
      error: undefined,
      quality
    }));
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file || processingState.isProcessing) return;

    // Reset state
    setDetectedText('');
    setConfidence(0);
    setManualEdit('');
    setShowManualEdit(false);
    setCameraError('');
    
    // Setup abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setProcessingState({
      isProcessing: true,
      progress: 0,
      stage: 'uploading',
      maxAttempts: maxRetries + 1
    });

    stopCamera();

    try {
      // Create preview
      const imageUrl = URL.createObjectURL(file);
      setPreviewImage(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return imageUrl;
      });

      updateProgress('uploading', 10, 'Image uploaded');

      // Try barcode scanning first if enabled
      if (enableBarcode && (scanMode === 'barcode' || scanMode === 'both')) {
        updateProgress('scanning_barcode', 20, 'Scanning for barcode...');
        try {
          const barcodeResults = await barcodeService.scanFromImage(file);
          if (barcodeResults.length > 0) {
            updateProgress('complete', 100, 'Barcode detected');
            setProcessingState(prev => ({ ...prev, isProcessing: false }));
            onResult(barcodeResults[0]);
            return;
          }
        } catch (barcodeError) {
          console.warn('Barcode scanning failed, falling back to OCR:', barcodeError);
        }
      }

      // Proceed with OCR if barcode failed or OCR mode
      if (scanMode === 'ocr' || scanMode === 'both') {
        updateProgress('preprocessing', 30, 'Optimizing image for OCR...');

        const ocrOptions: EnhancedOcrOptions = {
          timeoutMs: 25000, // Reduce timeout to prevent hanging
          signal,
          enableRetry: true,
          maxRetries,
          qualityThreshold,
          advancedPreprocessing: enableAdvancedPreprocessing,
          onProgress: (progress, status) => {
            const adjustedProgress = 30 + (progress * 0.6); // 30-90% range
            
            // Determine stage based on status
            let stage: ProcessingState['stage'] = 'extracting_text';
            if (status.includes('retry') || status.includes('attempt')) {
              stage = 'retry';
            } else if (status.includes('quality') || status.includes('assess')) {
              stage = 'quality_check';
            }
            
            updateProgress(stage, adjustedProgress, status);
          }
        };

        const result = await enhancedOcrService.processImage(file, ocrOptions);

        // Process result - be more lenient with success criteria
        const hasText = result.text && result.text.trim().length > 0;
        const hasReasonableConfidence = result.confidence > 0.2;
        const isExplicitSuccess = result.ok;
        
        if (isExplicitSuccess || (hasText && hasReasonableConfidence)) {
          updateProgress('complete', 100, 'OCR completed successfully');
          
          setDetectedText(result.text);
          setConfidence(result.confidence);
          setManualEdit(result.text);
          
          if (result.qualityMetrics) {
            updateProgress('complete', 100, 'Result processed', {
              confidence: result.qualityMetrics.confidence,
              qualityScore: result.qualityMetrics.qualityScore,
              hasNutritionKeywords: result.qualityMetrics.hasNutritionKeywords
            });
          }
          
          setProcessingState(prev => ({ ...prev, isProcessing: false }));
          onResult(result);
          
        } else if (hasText) {
          // Show manual edit for any text we found, even low confidence
          updateProgress('quality_check', 95, 'Low quality detected - please review');
          
          setDetectedText(result.text);
          setConfidence(result.confidence);
          setManualEdit(result.text);
          setShowManualEdit(true);
          
          if (result.qualityMetrics) {
            updateProgress('quality_check', 95, 'Please review and correct text', {
              confidence: result.qualityMetrics.confidence,
              qualityScore: result.qualityMetrics.qualityScore,
              hasNutritionKeywords: result.qualityMetrics.hasNutritionKeywords
            });
          }
          
          setProcessingState(prev => ({ ...prev, isProcessing: false }));
          
        } else {
          // Complete failure - show more helpful error
          const errorMsg = result.errorMessage === 'OCR processing timed out' 
            ? 'Processing timed out. Please try with a clearer image or better lighting.'
            : result.errorMessage || 'Unable to extract text from image. Please try with a clearer photo.';
          throw new Error(errorMsg);
        }
      }

    } catch (error) {
      console.error('Processing failed:', error);
      
      let errorMessage = 'Unknown error occurred';
      let errorStage: ProcessingState['stage'] = 'error';
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        errorMessage = 'Processing was cancelled';
        errorStage = 'idle';
      } else if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message.includes('timeout')) {
          errorMessage = 'Processing timed out. Please try with a clearer image.';
        } else if (error.message.includes('quality')) {
          errorMessage = 'Image quality too low. Please try with better lighting.';
        }
      }
      
      setProcessingState({ 
        isProcessing: false, 
        progress: 0, 
        stage: errorStage, 
        error: errorMessage 
      });
      
      onError(errorMessage);
      
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    scanMode,
    enableBarcode,
    maxRetries,
    qualityThreshold,
    enableAdvancedPreprocessing,
    onResult,
    onError,
    processingState.isProcessing,
    stopCamera,
    updateProgress,
  ]);

  const startCamera = useCallback(async () => {
    setCameraError('');

    try {
      stopCamera();
      
      if (typeof navigator === 'undefined' || typeof navigator.mediaDevices === 'undefined') {
        throw new Error('Camera not available in this environment');
      }

      // Check camera permission
      const hasPermission = await barcodeService.checkCameraPermission();
      if (!hasPermission) {
        throw new Error('Camera permission denied. Please allow camera access and try again.');
      }

      // Start media stream with mobile-optimized settings
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          aspectRatio: { ideal: 16/9 }
        }
      });
      
      streamRef.current = mediaStream;
      setIsUsingCamera(true);

      if (videoRef.current) {
        const videoElement = videoRef.current;
        videoElement.srcObject = mediaStream;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('muted', 'true');

        await new Promise<void>((resolve, reject) => {
          const handleLoaded = () => {
            videoElement.onloadedmetadata = null;
            videoElement.onerror = null;
            resolve();
          };
          
          const handleError = () => {
            videoElement.onloadedmetadata = null;
            videoElement.onerror = null;
            reject(new Error('Video loading failed'));
          };

          if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
            handleLoaded();
          } else {
            videoElement.onloadedmetadata = handleLoaded;
            videoElement.onerror = handleError;
          }
        });

        try {
          await videoElement.play();
        } catch (playError) {
          console.warn('Video playback could not start automatically:', playError);
        }

        // Start frame loop for display
        const startFrameLoop = () => {
          if (!videoRef.current || !canvasRef.current) return;

          const render = () => {
            if (!videoRef.current || !canvasRef.current) {
              frameLoopRef.current = null;
              return;
            }

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            if (!ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
              frameLoopRef.current = requestAnimationFrame(render);
              return;
            }

            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frameLoopRef.current = requestAnimationFrame(render);
          };

          frameLoopRef.current = requestAnimationFrame(render);
        };

        startFrameLoop();
      }

      // Initialize barcode scanner if enabled
      if (enableBarcode && (scanMode === 'barcode' || scanMode === 'both') && barcodeScannerRef.current) {
        try {
          await barcodeService.initializeScanner({
            target: barcodeScannerRef.current,
            formats: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader'],
            frequency: 10
          });

          await barcodeService.startScanning(
            (result) => {
              console.log('Live barcode detected:', result);
              stopCamera();
              onResult(result);
            },
            (error) => {
              console.error('Barcode scanning error:', error);
              setCameraError(`Barcode scanning error: ${error.message}`);
            }
          );
        } catch (barcodeError) {
          console.warn('Barcode scanner initialization failed:', barcodeError);
          setCameraError('Barcode scanning not available, but camera works for capture');
        }
      }

    } catch (error) {
      console.error('Camera access failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Camera access failed';
      setCameraError(errorMessage);
      onError(errorMessage);
      stopCamera();
    }
  }, [onError, onResult, scanMode, enableBarcode, stopCamera]);

  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) {
      onError('Camera or canvas not available');
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('Camera feed not ready yet');
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame
      ctx.drawImage(video, 0, 0);

      // Convert to blob and process
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9)
      );

      if (!blob) {
        throw new Error('Failed to capture image from camera');
      }

      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      await handleFileUpload(file);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Camera capture failed';
      onError(errorMessage);
    }
  }, [handleFileUpload, onError]);

  const handleManualSubmit = useCallback(() => {
    if (!manualEdit.trim()) return;

    try {
      const mockResult: OCRResult = {
        ok: true,
        text: manualEdit,
        confidence: 1.0,
        durationMs: 0,
        processingTime: 0,
        qualityMetrics: {
          confidence: 1.0,
          wordCount: manualEdit.split(' ').length,
          avgWordConfidence: 1.0,
          textLength: manualEdit.length,
          hasNutritionKeywords: true,
          hasNumericData: /\d/.test(manualEdit),
          qualityScore: 1.0
        }
      };

      setShowManualEdit(false);
      onResult(mockResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Manual submission failed';
      onError(errorMessage);
    }
  }, [manualEdit, onResult, onError]);

  const resetState = useCallback(() => {
    // Cancel any ongoing processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setPreviewImage(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    
    setDetectedText('');
    setConfidence(0);
    setShowManualEdit(false);
    setCameraError('');
    setManualEdit('');
    setProcessingState({ 
      isProcessing: false, 
      progress: 0, 
      stage: 'idle' 
    });
  }, []);

  const retryProcessing = useCallback(() => {
    if (previewImage && !processingState.isProcessing) {
      // Re-trigger processing with current preview image
      fetch(previewImage)
        .then(response => response.blob())
        .then(blob => {
          const file = new File([blob], 'retry-image.jpg', { type: 'image/jpeg' });
          handleFileUpload(file);
        })
        .catch(error => {
          console.error('Retry failed:', error);
          onError('Failed to retry processing');
        });
    }
  }, [previewImage, processingState.isProcessing, handleFileUpload, onError]);

  const getStageIcon = () => {
    const { stage, isProcessing } = processingState;
    
    if (isProcessing) {
      if (stage === 'retry') return <RefreshCw className="w-5 h-5 animate-spin" />;
      return <Loader2 className="w-5 h-5 animate-spin" />;
    }
    
    switch (stage) {
      case 'complete': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'quality_check': return <Gauge className="w-5 h-5 text-yellow-600" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getStageText = () => {
    const { stage, status } = processingState;
    return status || STAGE_DESCRIPTIONS[stage] || 'Processing...';
  };

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Enhanced Scan Mode Selection */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => { setScanMode('both'); resetState(); }}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
            scanMode === 'both'
              ? 'bg-white text-blue-600 shadow-sm ring-2 ring-blue-200'
              : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
          }`}
        >
          🎯 Smart Scan
        </button>
        {enableBarcode && (
          <button
            onClick={() => { setScanMode('barcode'); resetState(); }}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
              scanMode === 'barcode'
                ? 'bg-white text-blue-600 shadow-sm ring-2 ring-blue-200'
                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
            }`}
          >
            📱 Barcode Only
          </button>
        )}
        <button
          onClick={() => { setScanMode('ocr'); resetState(); }}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200 ${
            scanMode === 'ocr'
              ? 'bg-white text-blue-600 shadow-sm ring-2 ring-blue-200'
              : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
          }`}
        >
          📝 Text Only
        </button>
      </div>

      {/* Enhanced Camera View */}
      {isUsingCamera && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-64 bg-black rounded-lg object-cover"
          />
          
          {/* Barcode Scanner Overlay */}
          {enableBarcode && (scanMode === 'barcode' || scanMode === 'both') && (
            <div 
              ref={barcodeScannerRef}
              className="absolute inset-0 pointer-events-none"
            />
          )}
          
          {/* Enhanced Scanning Guide Overlay */}
          <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-32 border-2 border-white rounded-lg opacity-70">
              <div className="absolute -top-2 -left-2 w-4 h-4 border-l-2 border-t-2 border-white"></div>
              <div className="absolute -top-2 -right-2 w-4 h-4 border-r-2 border-t-2 border-white"></div>
              <div className="absolute -bottom-2 -left-2 w-4 h-4 border-l-2 border-b-2 border-white"></div>
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-r-2 border-b-2 border-white"></div>
            </div>
            
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm">
              {scanMode === 'barcode' && '📱 Point at barcode'}
              {scanMode === 'ocr' && '📝 Point at text label'}
              {scanMode === 'both' && '🎯 Scan barcode or text'}
            </div>
          </div>
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
            <button
              onClick={captureFromCamera}
              disabled={processingState.isProcessing}
              className="bg-white text-gray-900 px-6 py-3 rounded-full font-medium shadow-lg hover:bg-gray-100 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Capture
            </button>
            <button
              onClick={stopCamera}
              className="bg-red-600 text-white px-6 py-3 rounded-full font-medium shadow-lg hover:bg-red-700 transition-all duration-200 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Camera Error Display */}
      {cameraError && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-orange-900">Camera Issue</h4>
              <p className="text-orange-700 mt-1 text-sm">{cameraError}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setCameraError('')}
                  className="text-orange-600 hover:text-orange-800 font-medium text-sm"
                >
                  Dismiss
                </button>
                <button
                  onClick={startCamera}
                  className="text-orange-600 hover:text-orange-800 font-medium text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Upload Controls */}
      {!isUsingCamera && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processingState.isProcessing}
            className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <Upload className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
            <div className="text-left">
              <div className="font-medium text-gray-700 group-hover:text-blue-700">Upload Image</div>
              <div className="text-sm text-gray-500">JPG, PNG, WebP</div>
            </div>
          </button>
          
          <button
            onClick={startCamera}
            disabled={processingState.isProcessing}
            className="flex items-center justify-center gap-3 p-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <div className="font-medium">Use Camera</div>
              <div className="text-sm opacity-90">Live scanning</div>
            </div>
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        className="hidden"
      />

      {/* Enhanced Processing State */}
      {processingState.isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            {getStageIcon()}
            <div className="flex-1">
              <div className="font-medium text-blue-900">{getStageText()}</div>
              {processingState.attempt && processingState.maxAttempts && (
                <div className="text-sm text-blue-700">
                  Attempt {processingState.attempt} of {processingState.maxAttempts}
                </div>
              )}
            </div>
          </div>
          
          <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${processingState.progress}%` }}
            />
          </div>
          
          {processingState.quality && (
            <div className="text-sm text-blue-700 mt-2">
              Quality Score: 
              <span className={`font-medium ml-1 ${getQualityColor(processingState.quality.qualityScore)}`}>
                {Math.round(processingState.quality.qualityScore * 100)}%
              </span>
              {processingState.quality.hasNutritionKeywords && (
                <span className="ml-2 text-green-600">✓ Nutrition content detected</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Enhanced Error State */}
      {processingState.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900">Processing Error</h4>
              <p className="text-red-700 mt-1">{processingState.error}</p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={resetState}
                  className="text-red-600 hover:text-red-800 font-medium text-sm"
                >
                  Try Again
                </button>
                {previewImage && (
                  <button
                    onClick={retryProcessing}
                    className="text-red-600 hover:text-red-800 font-medium text-sm flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry with Enhanced Settings
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Preview Image */}
      {previewImage && !isUsingCamera && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Uploaded Image
            </h3>
            {processingState.quality && (
              <div className="text-sm">
                Quality: 
                <span className={`font-medium ml-1 ${getQualityColor(processingState.quality.qualityScore)}`}>
                  {Math.round(processingState.quality.qualityScore * 100)}%
                </span>
              </div>
            )}
          </div>
          
          <div className="relative">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="w-full h-48 object-contain bg-gray-50 rounded-lg border"
            />
            <button
              onClick={resetState}
              className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {!processingState.isProcessing && processingState.stage !== 'complete' && (
              <button
                onClick={retryProcessing}
                className="absolute top-2 left-2 bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100 transition-colors"
                title="Retry with enhanced settings"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Enhanced OCR Results */}
      {detectedText && !showManualEdit && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <div className="font-medium text-green-900">
                Text Extracted
              </div>
              <div className="text-sm text-green-700">
                Confidence: {Math.round(confidence * 100)}%
                {processingState.quality && (
                  <>
                    {' • '}Quality Score: {Math.round(processingState.quality.qualityScore * 100)}%
                    {processingState.quality.hasNutritionKeywords && ' • Nutrition content detected'}
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-3 mt-3 max-h-40 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">{detectedText}</pre>
          </div>
          
          {confidence < 0.8 && (
            <button
              onClick={() => setShowManualEdit(true)}
              className="mt-3 text-green-600 hover:text-green-800 font-medium text-sm flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Edit Text
            </button>
          )}
        </div>
      )}

      {/* Enhanced Manual Text Correction */}
      {showManualEdit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Gauge className="w-5 h-5 text-yellow-600" />
            <div className="flex-1">
              <div className="font-medium text-yellow-900">
                Quality Check - Please Review
              </div>
              <div className="text-sm text-yellow-700">
                The OCR result needs verification. Please review and correct the text below.
              </div>
            </div>
          </div>
          
          <textarea
            value={manualEdit}
            onChange={(e) => setManualEdit(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Review and correct the detected text..."
          />
          
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleManualSubmit}
              disabled={!manualEdit.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Use This Text
            </button>
            <button
              onClick={() => setShowManualEdit(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
            {previewImage && (
              <button
                onClick={retryProcessing}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-yellow-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry OCR
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
} 
