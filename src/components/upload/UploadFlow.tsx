'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, 
  Camera, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertCircle, 
  X, 
  RotateCcw,
  Crop,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Download,
  Share,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import type { UploadResponse, AnalysisResponse } from '@/lib/types';

interface UploadFlowProps {
  onComplete?: (result: AnalysisResponse) => void;
  onError?: (error: string) => void;
  className?: string;
}

interface UploadStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  active: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ImageEditState {
  rotation: number;
  contrast: number;
  brightness: number;
  saturation: number;
}

const STEPS: UploadStep[] = [
  { id: 'select', title: 'Select Image', description: 'Choose or capture supplement image', completed: false, active: true },
  { id: 'validate', title: 'Validate', description: 'Check image quality and format', completed: false, active: false },
  { id: 'edit', title: 'Edit', description: 'Enhance image if needed', completed: false, active: false },
  { id: 'process', title: 'Process', description: 'Analyze supplement information', completed: false, active: false },
  { id: 'review', title: 'Review', description: 'Review and save results', completed: false, active: false }
];

export function UploadFlow({ onComplete, onError, className = '' }: UploadFlowProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState(STEPS);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [imageEdit, setImageEdit] = useState<ImageEditState>({
    rotation: 0,
    contrast: 100,
    brightness: 100,
    saturation: 100
  });
  const [processing, setProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [showImageEditor, setShowImageEditor] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isUsingCamera, setIsUsingCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [stream, previewUrl]);

  // File validation
  const validateFile = useCallback((file: File): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // File size check (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      errors.push('File size must be less than 10MB');
    }

    // File type check
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.type)) {
      errors.push('File must be JPEG, PNG, WebP, or HEIC format');
    }

    // File size warning
    if (file.size > 5 * 1024 * 1024) {
      warnings.push('Large file size may take longer to process');
    }

    // Name check
    if (file.name.length > 100) {
      warnings.push('File name is very long');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }, []);

  // Step navigation
  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStepIndex(stepIndex);
      setSteps(prev => prev.map((step, index) => ({
        ...step,
        active: index === stepIndex,
        completed: index < stepIndex
      })));
    }
  }, [steps.length]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      goToStep(currentStepIndex + 1);
    }
  }, [currentStepIndex, steps.length, goToStep]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  // File selection handlers
  const handleFileSelect = useCallback((file: File) => {
    const validationResult = validateFile(file);
    setValidation(validationResult);

    if (validationResult.valid) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      nextStep(); // Go to validation step
    }
  }, [validateFile, nextStep]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // Camera functions
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      setIsUsingCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      onError?.('Failed to access camera: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [onError]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleFileSelect(file);
          setIsUsingCamera(false);
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
          }
        }
      }, 'image/jpeg', 0.9);
    }
  }, [handleFileSelect, stream]);

  // Image editing functions
  const applyImageEdits = useCallback(() => {
    if (!selectedFile || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const image = new Image();

    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;

      if (context) {
        // Apply transformations
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.save();

        // Rotation
        if (imageEdit.rotation !== 0) {
          context.translate(canvas.width / 2, canvas.height / 2);
          context.rotate((imageEdit.rotation * Math.PI) / 180);
          context.translate(-image.width / 2, -image.height / 2);
        }

        // Filters
        context.filter = `
          contrast(${imageEdit.contrast}%) 
          brightness(${imageEdit.brightness}%) 
          saturate(${imageEdit.saturation}%)
        `;

        context.drawImage(image, 0, 0);
        context.restore();

        // Convert back to blob
        canvas.toBlob((blob) => {
          if (blob) {
            const editedFile = new File([blob], selectedFile.name, { type: selectedFile.type });
            setSelectedFile(editedFile);
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(URL.createObjectURL(editedFile));
          }
        }, selectedFile.type, 0.9);
      }
    };

    if (previewUrl) {
      image.src = previewUrl;
    }
  }, [selectedFile, previewUrl, imageEdit]);

  // Processing functions
  const processImage = useCallback(async () => {
    if (!selectedFile) return;

    setProcessing(true);
    setProcessingProgress(0);

    try {
      // Step 1: Upload image (25%)
      setProcessingProgress(25);
      const uploadResult = await apiClient.uploadImage(selectedFile);
      setUploadResult(uploadResult);

      // Step 2: Analyze image (50%)
      setProcessingProgress(50);
      const analysisResult = await apiClient.analyzeSupplement(
        { imageUrl: uploadResult.imageUrl },
        { timeoutMs: 30000 }
      );

      // Step 3: Complete (100%)
      setProcessingProgress(100);
      setAnalysisResult(analysisResult);
      
      // Mark processing step as complete and move to review
      setSteps(prev => prev.map((step, index) => ({
        ...step,
        completed: index <= 3, // Mark up to processing as completed
        active: index === 4 // Activate review step
      })));
      setCurrentStepIndex(4);

    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
      onError?.(errorMessage);
      
      // Allow retry
      setRetryCount(prev => prev + 1);
    } finally {
      setProcessing(false);
    }
  }, [selectedFile, onError]);

  // Retry processing
  const retryProcessing = useCallback(() => {
    setProcessingProgress(0);
    processImage();
  }, [processImage]);

  // Complete flow
  const completeFlow = useCallback(() => {
    if (analysisResult) {
      onComplete?.(analysisResult);
    }
  }, [analysisResult, onComplete]);

  // Reset flow
  const resetFlow = useCallback(() => {
    setCurrentStepIndex(0);
    setSteps(STEPS);
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidation(null);
    setImageEdit({ rotation: 0, contrast: 100, brightness: 100, saturation: 100 });
    setProcessing(false);
    setUploadResult(null);
    setAnalysisResult(null);
    setProcessingProgress(0);
    setRetryCount(0);
    setShowImageEditor(false);
    setIsUsingCamera(false);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const currentStep = steps[currentStepIndex];

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                ${step.completed 
                  ? 'bg-green-500 border-green-500 text-white' 
                  : step.active 
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-gray-200 border-gray-300 text-gray-500'
                }
              `}>
                {step.completed ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              
              {index < steps.length - 1 && (
                <div className={`
                  w-16 h-0.5 mx-2 transition-colors
                  ${step.completed ? 'bg-green-500' : 'bg-gray-300'}
                `} />
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-4">
          <h2 className="text-xl font-semibold text-gray-900">{currentStep.title}</h2>
          <p className="text-gray-600">{currentStep.description}</p>
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="min-h-96"
        >
          {/* Step 1: Select Image */}
          {currentStepIndex === 0 && (
            <div className="space-y-6">
              {!isUsingCamera ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* File Upload */}
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Image</h3>
                    <p className="text-gray-600 mb-4">Choose a supplement label image from your device</p>
                    <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                      Choose File
                    </button>
                  </div>

                  {/* Camera Capture */}
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={startCamera}
                  >
                    <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Take Photo</h3>
                    <p className="text-gray-600 mb-4">Use your camera to capture the supplement label</p>
                    <button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors">
                      Open Camera
                    </button>
                  </div>
                </div>
              ) : (
                /* Camera View */
                <div className="space-y-4">
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-96 object-cover"
                    />
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 space-x-4">
                      <button
                        onClick={capturePhoto}
                        className="bg-white text-black px-6 py-3 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <Camera className="w-6 h-6" />
                      </button>
                      <button
                        onClick={() => {
                          setIsUsingCamera(false);
                          if (stream) {
                            stream.getTracks().forEach(track => track.stop());
                            setStream(null);
                          }
                        }}
                        className="bg-red-500 text-white px-6 py-3 rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          )}

          {/* Step 2: Validation */}
          {currentStepIndex === 1 && validation && (
            <div className="space-y-6">
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Image Validation Results</h3>
                
                {validation.valid ? (
                  <div className="flex items-center text-green-600 mb-4">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <span>Image passed all validation checks</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600 mb-4">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    <span>Image validation failed</span>
                  </div>
                )}

                {validation.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-red-700 mb-2">Errors:</h4>
                    <ul className="list-disc list-inside text-red-600 space-y-1">
                      {validation.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-yellow-700 mb-2">Warnings:</h4>
                    <ul className="list-disc list-inside text-yellow-600 space-y-1">
                      {validation.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {previewUrl && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Preview:</h4>
                    <img
                      src={previewUrl}
                      alt="Upload preview"
                      className="max-w-xs max-h-48 object-contain border rounded"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={prevStep}
                  className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                {validation.valid && (
                  <button
                    onClick={nextStep}
                    className="flex items-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Edit Image */}
          {currentStepIndex === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Image Preview */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Image Preview</h3>
                  {previewUrl && (
                    <div className="border rounded-lg overflow-hidden">
                      <img
                        src={previewUrl}
                        alt="Image preview"
                        className="w-full h-64 object-contain bg-gray-50"
                        style={{
                          transform: `rotate(${imageEdit.rotation}deg)`,
                          filter: `contrast(${imageEdit.contrast}%) brightness(${imageEdit.brightness}%) saturate(${imageEdit.saturation}%)`
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Edit Controls */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Image Adjustments</h3>
                  
                  {/* Rotation */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Rotation</label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setImageEdit(prev => ({ ...prev, rotation: prev.rotation - 90 }))}
                        className="p-2 border rounded hover:bg-gray-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <span className="text-sm text-gray-600">{imageEdit.rotation}°</span>
                      <button
                        onClick={() => setImageEdit(prev => ({ ...prev, rotation: prev.rotation + 90 }))}
                        className="p-2 border rounded hover:bg-gray-50"
                      >
                        <RotateCcw className="w-4 h-4 transform scale-x-[-1]" />
                      </button>
                    </div>
                  </div>

                  {/* Contrast */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Contrast: {imageEdit.contrast}%
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      value={imageEdit.contrast}
                      onChange={(e) => setImageEdit(prev => ({ ...prev, contrast: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  {/* Brightness */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Brightness: {imageEdit.brightness}%
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      value={imageEdit.brightness}
                      onChange={(e) => setImageEdit(prev => ({ ...prev, brightness: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  {/* Saturation */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Saturation: {imageEdit.saturation}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={imageEdit.saturation}
                      onChange={(e) => setImageEdit(prev => ({ ...prev, saturation: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => setImageEdit({ rotation: 0, contrast: 100, brightness: 100, saturation: 100 })}
                      className="px-4 py-2 border rounded hover:bg-gray-50"
                    >
                      Reset
                    </button>
                    <button
                      onClick={applyImageEdits}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Apply Changes
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={prevStep}
                  className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <button
                  onClick={nextStep}
                  className="flex items-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Process Image
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Processing */}
          {currentStepIndex === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mb-6">
                  {processing ? (
                    <Loader2 className="mx-auto h-16 w-16 text-blue-500 animate-spin" />
                  ) : (
                    <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                  )}
                </div>

                <h3 className="text-xl font-semibold mb-2">
                  {processing ? 'Processing Image...' : 'Processing Complete!'}
                </h3>

                <div className="max-w-md mx-auto">
                  <div className="bg-gray-200 rounded-full h-3 mb-4">
                    <div 
                      className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${processingProgress}%` }}
                    />
                  </div>
                  <p className="text-gray-600">{processingProgress}% complete</p>
                </div>

                {!processing && !analysisResult && retryCount > 0 && (
                  <div className="mt-6">
                    <p className="text-red-600 mb-4">Processing failed. Would you like to try again?</p>
                    <button
                      onClick={retryProcessing}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      Retry Processing
                    </button>
                  </div>
                )}

                {!processing && !analysisResult && retryCount === 0 && (
                  <button
                    onClick={processImage}
                    className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Start Processing
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Review Results */}
          {currentStepIndex === 4 && analysisResult && (
            <div className="space-y-6">
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Analysis Results</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Results Summary */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Supplement Name</h4>
                      <p className="text-gray-700">{analysisResult.supplementName}</p>
                    </div>
                    
                    {analysisResult.brand && (
                      <div>
                        <h4 className="font-medium text-gray-900">Brand</h4>
                        <p className="text-gray-700">{analysisResult.brand}</p>
                      </div>
                    )}
                    
                    <div>
                      <h4 className="font-medium text-gray-900">Confidence Score</h4>
                      <div className="flex items-center space-x-2">
                        <div className="bg-gray-200 rounded-full h-2 flex-1">
                          <div 
                            className={`h-2 rounded-full ${
                              analysisResult.confidence > 80 ? 'bg-green-500' :
                              analysisResult.confidence > 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${analysisResult.confidence}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{analysisResult.confidence}%</span>
                      </div>
                    </div>

                    {analysisResult.ingredients && analysisResult.ingredients.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Ingredients</h4>
                        <div className="space-y-1">
                          {analysisResult.ingredients.slice(0, 5).map((ingredient, index) => (
                            <div key={index} className="text-sm text-gray-700">
                              {ingredient.name} - {ingredient.amount} {ingredient.unit}
                            </div>
                          ))}
                          {analysisResult.ingredients.length > 5 && (
                            <p className="text-sm text-gray-500">
                              +{analysisResult.ingredients.length - 5} more ingredients
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Image Preview */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Processed Image</h4>
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Processed supplement"
                        className="w-full h-48 object-contain border rounded"
                      />
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center mt-6 pt-6 border-t">
                  <button
                    onClick={resetFlow}
                    className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Start Over
                  </button>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {/* Export functionality */}}
                      className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </button>
                    <button
                      onClick={() => {/* Share functionality */}}
                      className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Share className="w-4 h-4 mr-2" />
                      Share
                    </button>
                    <button
                      onClick={completeFlow}
                      className="flex items-center px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
} 