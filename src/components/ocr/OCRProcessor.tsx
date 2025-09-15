'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, RotateCcw, Zap, AlertCircle, CheckCircle, X } from 'lucide-react';
import { ocrService, OCRResult } from '@/lib/ocr';
import { barcodeService, BarcodeResult } from '@/lib/barcode';

interface OCRProcessorProps {
  onResult: (result: OCRResult | BarcodeResult) => void;
  onError: (error: string) => void;
  className?: string;
}

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  stage: 'idle' | 'uploading' | 'enhancing' | 'scanning_barcode' | 'extracting_text' | 'parsing' | 'complete';
  error?: string;
}

export function OCRProcessor({ onResult, onError, className = '' }: OCRProcessorProps) {
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
  const [isUsingCamera, setIsUsingCamera] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  // Cleanup resources
  const cleanupResources = useCallback(() => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      ocrService.cleanup();
      barcodeService.cleanup();
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }, [stream]);

  const updateProgress = useCallback((stage: ProcessingState['stage'], progress: number) => {
    setProcessingState(prev => ({ ...prev, stage, progress }));
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    try {
      setProcessingState({ isProcessing: true, progress: 0, stage: 'uploading' });
      setCameraError('');
      
      // Create preview
      const imageUrl = URL.createObjectURL(file);
      setPreviewImage(imageUrl);
      updateProgress('uploading', 20);

      // Process based on scan mode
      if (scanMode === 'barcode' || scanMode === 'both') {
        updateProgress('scanning_barcode', 40);
        
        try {
          const barcodeResults = await barcodeService.scanFromImage(file);
          
          if (barcodeResults.length > 0) {
            updateProgress('complete', 100);
            setProcessingState({ isProcessing: false, progress: 100, stage: 'complete' });
            onResult(barcodeResults[0]);
            return;
          }
        } catch (barcodeError) {
          console.warn('Barcode scanning failed, falling back to OCR:', barcodeError);
        }
      }

      if (scanMode === 'ocr' || scanMode === 'both') {
        updateProgress('enhancing', 50);
        
        // Process with OCR
        updateProgress('extracting_text', 70);
        const ocrResult = await ocrService.processImage(file);
        
        updateProgress('parsing', 90);
        setDetectedText(ocrResult.text);
        setConfidence(ocrResult.confidence);
        setManualEdit(ocrResult.text);

        updateProgress('complete', 100);
        setProcessingState({ isProcessing: false, progress: 100, stage: 'complete' });

        // Show manual edit if confidence is low
        if (ocrResult.confidence < 0.8) {
          setShowManualEdit(true);
        } else {
          onResult(ocrResult);
        }
      }

    } catch (error) {
      console.error('Processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setProcessingState({ 
        isProcessing: false, 
        progress: 0, 
        stage: 'idle', 
        error: errorMessage 
      });
      onError(errorMessage);
    }
  }, [scanMode, onResult, onError, updateProgress]);

  const startCamera = useCallback(async () => {
    setCameraError('');
    
    try {
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
      setIsUsingCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // Wait for video to be ready
        await new Promise((resolve, reject) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve(true);
            videoRef.current.onerror = () => reject(new Error('Video loading failed'));
          }
        });
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
  }, [scanMode, onResult, onError]);

  const stopCamera = useCallback(() => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setIsUsingCamera(false);
      setCameraError('');
      barcodeService.stopScanning();
    } catch (error) {
      console.warn('Error stopping camera:', error);
    }
  }, [stream]);

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

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame
      ctx.drawImage(video, 0, 0);

      // Convert to blob and process
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          await handleFileUpload(file);
        } else {
          onError('Failed to capture image from camera');
        }
      }, 'image/jpeg', 0.8);

      stopCamera();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Camera capture failed';
      onError(errorMessage);
    }
  }, [handleFileUpload, stopCamera, onError]);

  const handleManualSubmit = useCallback(() => {
    if (!manualEdit.trim()) return;

    try {
      // Create mock OCR result with manual text
      const mockResult: OCRResult = {
        text: manualEdit,
        confidence: 1.0, // High confidence for manual input
        ingredients: [],
        processingTime: 0,
        warnings: []
      };

      setShowManualEdit(false);
      onResult(mockResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Manual submission failed';
      onError(errorMessage);
    }
  }, [manualEdit, onResult, onError]);

  const resetState = useCallback(() => {
    setPreviewImage(null);
    setDetectedText('');
    setShowManualEdit(false);
    setCameraError('');
    setProcessingState({ isProcessing: false, progress: 0, stage: 'idle' });
  }, []);

  const getStageText = () => {
    switch (processingState.stage) {
      case 'uploading': return 'Uploading image...';
      case 'enhancing': return 'Enhancing image quality...';
      case 'scanning_barcode': return 'Scanning for barcode...';
      case 'extracting_text': return 'Extracting text with OCR...';
      case 'parsing': return 'Parsing supplement information...';
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