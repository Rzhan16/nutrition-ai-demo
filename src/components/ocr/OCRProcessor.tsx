'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, RotateCcw, Zap, AlertCircle, CheckCircle, X } from 'lucide-react';
import type { OCRResult } from '@/lib/types';
import { barcodeService, BarcodeResult } from '@/lib/barcode';
import type { RecognizeResult } from 'tesseract.js';
import { getOcrWorker } from '@/lib/ocr/worker';
import type { TesseractLoggerMessage } from '@/lib/ocr/worker';
import { fileToCanvas } from '@/lib/ocr/preprocess';

interface OCRProcessorProps {
  onResult: (result: OCRResult | BarcodeResult) => void;
  onError: (error: string) => void;
  className?: string;
}

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  stage: 'idle' | 'uploading' | 'enhancing' | 'scanning_barcode' | 'extracting_text' | 'parsing' | 'complete' | 'error';
  error?: string;
  status?: string;
}

export function OCRProcessor({ onResult, onError, className = '' }: OCRProcessorProps) {
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    stage: 'idle',
    status: undefined,
    error: undefined,
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
  const isProcessingRef = useRef(false);
  const [isUsingCamera, setIsUsingCamera] = useState<boolean>(false);
  const [, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');

  const stopFrameLoop = useCallback(() => {
    if (frameLoopRef.current !== null) {
      cancelAnimationFrame(frameLoopRef.current);
      frameLoopRef.current = null;
    }
  }, []);

  const stopLiveScan = useCallback(() => {
    stopFrameLoop();
    const currentStream = streamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream((prev) => {
      if (prev) {
        prev.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
    setIsUsingCamera(false);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch (pauseError) {
        console.warn('Video pause failed:', pauseError);
      }
      videoRef.current.srcObject = null;
    }
    barcodeService.stopScanning();
  }, [setStream, setIsUsingCamera, stopFrameLoop]);

  const startFrameLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const render = () => {
      if (!videoRef.current || !canvasRef.current) {
        frameLoopRef.current = null;
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        frameLoopRef.current = null;
        return;
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      frameLoopRef.current = requestAnimationFrame(render);
    };

    stopFrameLoop();
    frameLoopRef.current = requestAnimationFrame(render);
  }, [stopFrameLoop]);

  // Cleanup resources
  const cleanupResources = useCallback(() => {
    try {
      stopLiveScan();
      barcodeService.cleanup();
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }, [stopLiveScan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  const updateProgress = useCallback(
    (stage: ProcessingState['stage'], progress: number, status?: string) => {
      setProcessingState((prev) => ({
        ...prev,
        stage,
        progress,
        status,
        error: undefined,
      }));
    },
  []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file || isProcessingRef.current) return;

    isProcessingRef.current = true;

    setProcessingState({ isProcessing: true, progress: 0, stage: 'uploading', error: undefined, status: 'Preparing image' });
    setCameraError('');
    setShowManualEdit(false);
    setDetectedText('');
    setConfidence(0);
    setManualEdit('');

    stopLiveScan();

    try {
      const imageUrl = URL.createObjectURL(file);
      setPreviewImage((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return imageUrl;
      });

      updateProgress('uploading', 20, 'Image uploaded');

      if (scanMode === 'barcode' || scanMode === 'both') {
        updateProgress('scanning_barcode', 40, 'Scanning for barcode');
        try {
          const barcodeResults = await barcodeService.scanFromImage(file);
          if (barcodeResults.length > 0) {
            updateProgress('complete', 100, 'Barcode detected');
            setProcessingState({ isProcessing: false, progress: 100, stage: 'complete', status: 'Barcode detected' });
            onResult(barcodeResults[0]);
            isProcessingRef.current = false;
            return;
          }
        } catch (barcodeError) {
          console.warn('Barcode scanning failed, falling back to OCR:', barcodeError);
        }
      }

      if (scanMode === 'ocr' || scanMode === 'both') {
        updateProgress('enhancing', 50, 'Preparing image for OCR');
        const canvas = await fileToCanvas(file, 1600);
        updateProgress('extracting_text', 60, 'Running OCR');

        const recognitionStartedAt = performance.now();
        const worker = await getOcrWorker((message: TesseractLoggerMessage) => {
          if (typeof message.progress === 'number') {
            const percent = Math.round(Math.min(1, Math.max(0, message.progress)) * 100);
            setProcessingState((prev) => ({
              ...prev,
              stage: 'extracting_text',
              progress: Math.max(prev.progress, percent),
              status: message.status ?? prev.status,
            }));
          } else if (message.status) {
            setProcessingState((prev) => ({
              ...prev,
              status: message.status,
            }));
          }
        });

        const recognizePromise: Promise<RecognizeResult> = worker.recognize(canvas as HTMLCanvasElement);
        const recognition = await Promise.race([
          recognizePromise,
          new Promise<never>((_, reject) => {
            const timeoutId = window.setTimeout(() => {
              reject(new Error('OCR timeout'));
            }, 30000);
            recognizePromise.then(
              () => window.clearTimeout(timeoutId),
              () => window.clearTimeout(timeoutId),
            );
          }),
        ]);

        const durationMs = Math.round(performance.now() - recognitionStartedAt);
        const text = recognition.data?.text ?? '';
        const confidenceRaw = recognition.data?.confidence;
        const confidenceScore = typeof confidenceRaw === 'number' ? confidenceRaw / 100 : 0;
        const warningsRaw = (recognition.data as { warnings?: unknown } | undefined)?.warnings ?? [];
        const warnings = Array.isArray(warningsRaw)
          ? warningsRaw.filter((item): item is string => typeof item === 'string')
          : [];

        updateProgress('parsing', 90, 'Parsing OCR results');

        setDetectedText(text);
        setConfidence(confidenceScore);
        setManualEdit(text);

        const ocrResult: OCRResult = {
          ok: confidenceScore >= 0.8,
          text,
          confidence: confidenceScore,
          durationMs,
          processingTime: durationMs,
          warnings,
        };

        updateProgress('complete', 100, 'OCR complete');
        setProcessingState({ isProcessing: false, progress: 100, stage: 'complete', status: 'OCR complete' });

        if (confidenceScore < 0.8) {
          setShowManualEdit(true);
        } else {
          onResult(ocrResult);
        }
      } else {
        setProcessingState({ isProcessing: false, progress: 100, stage: 'complete', status: 'Completed' });
      }
    } catch (error) {
      console.error('Processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setProcessingState({ isProcessing: false, progress: 0, stage: 'error', error: errorMessage, status: 'Error' });
      onError(errorMessage);
    } finally {
      isProcessingRef.current = false;
    }
  }, [scanMode, onResult, onError, stopLiveScan, updateProgress]);

  const stopCamera = useCallback(() => {
    try {
      stopLiveScan();
      setCameraError('');
      barcodeService.cleanup();
    } catch (error) {
      console.warn('Error stopping camera:', error);
    }
  }, [stopLiveScan]);

  const startCamera = useCallback(async () => {
    setCameraError('');

    try {
      stopCamera();
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Camera not available in this environment');
      }

      // Check camera permission first
      const hasPermission = await barcodeService.checkCameraPermission();
      if (!hasPermission) {
        throw new Error('Camera permission denied. Please allow camera access and try again.');
      }

      // Start media stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      setStream(mediaStream);
      streamRef.current = mediaStream;
      setIsUsingCamera(true);

      if (videoRef.current) {
        const videoElement = videoRef.current;
        videoElement.srcObject = mediaStream;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('muted', 'true');

        const waitForMetadata = new Promise<void>((resolve, reject) => {
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

        await waitForMetadata;
        try {
          await videoElement.play();
        } catch (playError) {
          console.warn('Video playback could not start automatically:', playError);
        }
        startFrameLoop();
      }

      // Initialize barcode scanner only if in barcode mode
      if ((scanMode === 'barcode' || scanMode === 'both') && barcodeScannerRef.current) {
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
          setCameraError('Barcode scanning not available, but camera works for OCR capture');
        }
      }

    } catch (error) {
      console.error('Camera access failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Camera access failed';
      setCameraError(errorMessage);
      onError(errorMessage);
      stopCamera();
    }
  }, [onError, onResult, scanMode, startFrameLoop, stopCamera]);

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
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.8)
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
      // Create mock OCR result with manual text
      const mockResult: OCRResult = {
        ok: true,
        text: manualEdit,
        confidence: 1.0, // High confidence for manual input
        durationMs: 0,
        ingredients: [],
        processingTime: 0,
        warnings: [],
      };

      setShowManualEdit(false);
      onResult(mockResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Manual submission failed';
      onError(errorMessage);
    }
  }, [manualEdit, onResult, onError]);

  const resetState = useCallback(() => {
    setPreviewImage((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setDetectedText('');
    setConfidence(0);
    setShowManualEdit(false);
    setCameraError('');
    setManualEdit('');
    setProcessingState({ isProcessing: false, progress: 0, stage: 'idle', error: undefined, status: undefined });
  }, []);

  const getStageText = () => {
    switch (processingState.stage) {
      case 'uploading': return 'Uploading image...';
      case 'enhancing': return 'Enhancing image quality...';
      case 'scanning_barcode': return 'Scanning for barcode...';
      case 'extracting_text': return 'Extracting text with OCR...';
      case 'parsing': return 'Parsing supplement information...';
      case 'error': return processingState.error ?? 'Processing error';
      case 'complete': return 'Processing complete!';
      default: return 'Ready to scan';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Scan Mode Selection */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => { setScanMode('both'); resetState(); }}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            scanMode === 'both'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          Smart Scan
        </button>
        <button
          onClick={() => { setScanMode('barcode'); resetState(); }}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            scanMode === 'barcode'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          Barcode Only
        </button>
        <button
          onClick={() => { setScanMode('ocr'); resetState(); }}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
            scanMode === 'ocr'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          Text Only
        </button>
      </div>

      {/* Camera View */}
      {isUsingCamera && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-64 bg-black rounded-lg object-cover"
          />
          
          {/* Barcode Scanner Overlay */}
          {(scanMode === 'barcode' || scanMode === 'both') && (
            <div 
              ref={barcodeScannerRef}
              className="absolute inset-0 pointer-events-none"
            />
          )}
          
          {/* Scanning Guide Overlay */}
          <div className="absolute inset-0 border-2 border-blue-400 rounded-lg pointer-events-none">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-32 border-2 border-white rounded-lg opacity-50" />
            {scanMode === 'barcode' && (
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                📱 Point at barcode
              </div>
            )}
            {scanMode === 'ocr' && (
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                📝 Point at text label
              </div>
            )}
            {scanMode === 'both' && (
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                🎯 Scan barcode or text
              </div>
            )}
          </div>
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            <button
              onClick={captureFromCamera}
              disabled={processingState.isProcessing}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium shadow-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Capture
            </button>
            <button
              onClick={stopCamera}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium shadow-lg hover:bg-red-700 transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Camera Error Display */}
      {cameraError && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="font-medium text-orange-900">Camera Issue</span>
          </div>
          <p className="text-orange-700 mt-1 text-sm">{cameraError}</p>
          <button
            onClick={() => setCameraError('')}
            className="mt-2 text-orange-600 hover:text-orange-800 font-medium text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Controls */}
      {!isUsingCamera && (
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processingState.isProcessing}
            className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 transition-colors disabled:opacity-50"
          >
            <Upload className="w-5 h-5" />
            Upload Image
          </button>
          
          <button
            onClick={startCamera}
            disabled={processingState.isProcessing}
            className="flex items-center justify-center gap-2 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            Use Camera
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

      {/* Processing State */}
      {processingState.isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-blue-600 animate-pulse" />
            <span className="font-medium text-blue-900">{getStageText()}</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${processingState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error State */}
      {processingState.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="font-medium text-red-900">Processing Error</span>
          </div>
          <p className="text-red-700 mt-1">{processingState.error}</p>
          <button
            onClick={resetState}
            className="mt-2 text-red-600 hover:text-red-800 font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Preview Image */}
      {previewImage && !isUsingCamera && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-900">Uploaded Image</h3>
          <div className="relative">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="w-full h-48 object-contain bg-gray-50 rounded-lg border"
            />
            <button
              onClick={resetState}
              className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* OCR Results */}
      {detectedText && !showManualEdit && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900">
              Text Extracted (Confidence: {Math.round(confidence * 100)}%)
            </span>
          </div>
          <div className="bg-white border rounded p-3 mt-2">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap">{detectedText}</pre>
          </div>
          {confidence < 0.8 && (
            <button
              onClick={() => setShowManualEdit(true)}
              className="mt-2 text-green-600 hover:text-green-800 font-medium"
            >
              Edit Text
            </button>
          )}
        </div>
      )}

      {/* Manual Text Correction */}
      {showManualEdit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="font-medium text-yellow-900">
              Low Confidence Detected - Please Review
            </span>
          </div>
          <textarea
            value={manualEdit}
            onChange={(e) => setManualEdit(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Review and correct the detected text..."
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleManualSubmit}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Use This Text
            </button>
            <button
              onClick={() => setShowManualEdit(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
} 
