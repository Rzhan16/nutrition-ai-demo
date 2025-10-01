/**
 * Optimized OCR Test Page
 * 
 * This page demonstrates the enhanced OCR functionality with:
 * - OptimizedOCRProcessor component
 * - Enhanced error handling
 * - Quality assessment
 * - Mobile optimization
 */

'use client';

import React, { useState } from 'react';
import { OptimizedOCRProcessor } from '@/components/ocr/OptimizedOCRProcessor';
import type { OCRResult } from '@/lib/types';
import { BarcodeResult } from '@/lib/barcode';
import { ToastProvider, useToast } from '@/components/ui/ToastProvider';

function OptimizedAnalyzePage() {
  const [result, setResult] = useState<OCRResult | BarcodeResult | null>(null);
  const { showToast } = useToast();

  const handleResult = (ocrResult: OCRResult | BarcodeResult) => {
    console.log('🎉 OCR Result:', ocrResult);
    setResult(ocrResult);
    
    if ('text' in ocrResult && ocrResult.text) {
      showToast({
        tone: 'success',
        title: 'OCR Complete',
        description: `Extracted ${ocrResult.text.length} characters with ${Math.round((ocrResult.confidence || 0) * 100)}% confidence`
      });
    } else if ('code' in ocrResult && ocrResult.code) {
      showToast({
        tone: 'success',
        title: 'Barcode Detected',
        description: `Found ${ocrResult.format} barcode: ${ocrResult.code}`
      });
    }
  };

  const handleError = (error: string) => {
    console.error('❌ OCR Error:', error);
    showToast({
      tone: 'error',
      title: 'Processing Failed',
      description: error
    });
  };

  const resetResult = () => {
    setResult(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🚀 Optimized OCR Scanner
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Test the enhanced OCR system with improved error handling, mobile optimization, 
          and nutrition-specific features. Upload supplement labels or use the camera to scan.
        </p>
      </div>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">🎯 Smart Quality Assessment</h3>
          <p className="text-blue-700 text-sm">
            Multi-factor confidence scoring with nutrition keyword detection and automatic retry logic.
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">📱 Mobile Optimized</h3>
          <p className="text-green-700 text-sm">
            Touch-friendly interface with optimized camera settings and auto-rotation detection.
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-semibold text-purple-900 mb-2">💊 Nutrition Focused</h3>
          <p className="text-purple-700 text-sm">
            Enhanced extraction for supplement facts, ingredients, and brand recognition.
          </p>
        </div>
      </div>

      {/* OCR Processor */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <OptimizedOCRProcessor 
          onResult={handleResult}
          onError={handleError}
          enableBarcode={true}
          qualityThreshold={0.75}
          maxRetries={2}
          enableAdvancedPreprocessing={true}
        />
      </div>

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Results</h2>
            <button
              onClick={resetResult}
              className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear Results
            </button>
          </div>

          {/* OCR Results */}
          {'text' in result && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Basic Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Confidence:</span>
                    <div className="font-medium">{Math.round((result.confidence || 0) * 100)}%</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Processing Time:</span>
                    <div className="font-medium">{result.durationMs || 0}ms</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Text Length:</span>
                    <div className="font-medium">{result.text.length} chars</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Word Count:</span>
                    <div className="font-medium">{result.words?.length || 0} words</div>
                  </div>
                </div>
              </div>

              {/* Quality Metrics */}
              {result.qualityMetrics && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Quality Assessment</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600">Quality Score:</span>
                      <div className="font-medium text-lg">
                        {Math.round(result.qualityMetrics.qualityScore * 100)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-blue-600">Avg Word Confidence:</span>
                      <div className="font-medium">
                        {Math.round(result.qualityMetrics.avgWordConfidence * 100)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-blue-600">Features:</span>
                      <div className="space-y-1">
                        {result.qualityMetrics.hasNutritionKeywords && (
                          <div className="text-green-600">✓ Nutrition content</div>
                        )}
                        {result.qualityMetrics.hasNumericData && (
                          <div className="text-green-600">✓ Numeric data</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Text */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Extracted Text</h3>
                <div className="bg-white border rounded p-3 max-h-40 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {result.text}
                  </pre>
                </div>
              </div>

              {/* Nutrition Information */}
              {(result.ingredients || result.brand || result.productName || result.servingSize) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-2">Nutrition Information</h3>
                  <div className="space-y-3">
                    {result.brand && (
                      <div>
                        <span className="text-green-600 font-medium">Brand:</span>
                        <span className="ml-2">{result.brand}</span>
                      </div>
                    )}
                    {result.productName && (
                      <div>
                        <span className="text-green-600 font-medium">Product:</span>
                        <span className="ml-2">{result.productName}</span>
                      </div>
                    )}
                    {result.servingSize && (
                      <div>
                        <span className="text-green-600 font-medium">Serving Size:</span>
                        <span className="ml-2">{result.servingSize}</span>
                      </div>
                    )}
                    {result.ingredients && result.ingredients.length > 0 && (
                      <div>
                        <span className="text-green-600 font-medium">Ingredients:</span>
                        <div className="mt-2 space-y-1">
                          {result.ingredients.map((ingredient, index) => (
                            <div key={index} className="bg-white rounded p-2 text-sm">
                              <span className="font-medium">{ingredient.name}</span>
                              {ingredient.amount && (
                                <span className="text-gray-600 ml-2">
                                  {ingredient.amount}{ingredient.unit}
                                  {ingredient.dailyValue && ` (${ingredient.dailyValue}% DV)`}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-900 mb-2">Warnings & Notes</h3>
                  <ul className="space-y-1">
                    {result.warnings.map((warning, index) => (
                      <li key={index} className="text-yellow-800 text-sm">
                        ⚠️ {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Barcode Results */}
          {'code' in result && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Barcode Information</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-blue-600 font-medium">Code:</span>
                  <span className="ml-2 font-mono">{result.code}</span>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Format:</span>
                  <span className="ml-2">{result.format}</span>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Engine:</span>
                  <span className="ml-2">{result.engine}</span>
                </div>
                {result.confidence && (
                  <div>
                    <span className="text-blue-600 font-medium">Confidence:</span>
                    <span className="ml-2">{Math.round(result.confidence * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug Information */}
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <details>
          <summary className="cursor-pointer font-medium text-gray-700">
            🔧 Debug Information
          </summary>
          <div className="mt-2 text-sm text-gray-600">
            <p><strong>Optimizations Active:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Worker pool management for memory efficiency</li>
              <li>Intelligent retry logic with progressive fallbacks</li>
              <li>Quality assessment with nutrition-specific scoring</li>
              <li>Enhanced image preprocessing pipeline</li>
              <li>Mobile-optimized camera settings</li>
              <li>Result caching with SHA-256 keys</li>
            </ul>
            {result && (
              <div className="mt-4">
                <p><strong>Raw Result:</strong></p>
                <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

export default function OptimizedAnalyzePageWithToast() {
  return (
    <ToastProvider>
      <OptimizedAnalyzePage />
    </ToastProvider>
  );
} 
