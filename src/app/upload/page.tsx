'use client';

import React, { useState } from 'react';
import { UploadFlow } from '@/components/upload/UploadFlow';
import type { AnalysisResponse } from '@/lib/types';

export default function UploadPage() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleUploadComplete = (result: AnalysisResponse) => {
    setAnalysisResult(result);
    setShowResult(true);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    // Could show toast notification
  };

  const resetFlow = () => {
    setAnalysisResult(null);
    setShowResult(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Advanced Upload Workflow
            </h1>
            <p className="text-lg text-gray-600">
              Multi-step supplement analysis with image editing and validation
            </p>
          </div>

          {/* Features Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-blue-600 font-semibold mb-1">📱 Camera Integration</div>
              <div className="text-sm text-gray-600">Take photos directly with your camera</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-green-600 font-semibold mb-1">🎨 Image Editing</div>
              <div className="text-sm text-gray-600">Rotate, adjust contrast and brightness</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-purple-600 font-semibold mb-1">✅ Smart Validation</div>
              <div className="text-sm text-gray-600">Automatic file validation and feedback</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-yellow-600 font-semibold mb-1">🔄 Retry Mechanism</div>
              <div className="text-sm text-gray-600">Automatic retries for failed uploads</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {!showResult ? (
          <div className="bg-white rounded-lg shadow-sm">
            <UploadFlow
              onComplete={handleUploadComplete}
              onError={handleUploadError}
              className="p-6"
            />
          </div>
        ) : (
          /* Results Display */
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-900">Analysis Complete!</h2>
                <button
                  onClick={resetFlow}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Upload Another
                </button>
              </div>

              {analysisResult && (
                <div className="space-y-6">
                  {/* Supplement Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Supplement Details</h3>
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium text-gray-700">Name:</span>
                          <span className="ml-2 text-gray-600">{analysisResult.supplementName}</span>
                        </div>
                        {analysisResult.brand && (
                          <div>
                            <span className="font-medium text-gray-700">Brand:</span>
                            <span className="ml-2 text-gray-600">{analysisResult.brand}</span>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-700">Confidence:</span>
                          <span className="ml-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              analysisResult.confidence > 80 
                                ? 'bg-green-100 text-green-800'
                                : analysisResult.confidence > 60
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {analysisResult.confidence}%
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Analysis Method</h3>
                      <div className="space-y-2">
                        {analysisResult.analysisMethod && (
                          <div>
                            <span className="font-medium text-gray-700">Method:</span>
                            <span className="ml-2 text-gray-600">{analysisResult.analysisMethod}</span>
                          </div>
                        )}
                        {analysisResult.ocrConfidence && (
                          <div>
                            <span className="font-medium text-gray-700">OCR Confidence:</span>
                            <span className="ml-2 text-gray-600">{analysisResult.ocrConfidence}%</span>
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-gray-700">Cached Result:</span>
                          <span className="ml-2 text-gray-600">{analysisResult.cached ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ingredients */}
                  {analysisResult.ingredients && analysisResult.ingredients.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Ingredients</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {analysisResult.ingredients.map((ingredient, index) => (
                            <div key={index} className="bg-white p-3 rounded border">
                              <div className="font-medium text-gray-900">{ingredient.name}</div>
                              <div className="text-sm text-gray-600">
                                {ingredient.amount} {ingredient.unit}
                                {ingredient.dailyValue && (
                                  <span className="ml-2 text-blue-600">({ingredient.dailyValue}% DV)</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Analysis Sections */}
                  {analysisResult.analysis && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Professional Analysis</h3>
                      <div className="space-y-4">
                        {Object.entries(analysisResult.analysis).map(([key, value]) => (
                          <div key={key} className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium text-gray-900 mb-2 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </h4>
                            <p className="text-gray-700 leading-relaxed">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings and Recommendations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {analysisResult.warnings && analysisResult.warnings.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-red-700 mb-3">⚠️ Warnings</h3>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <ul className="space-y-2">
                            {analysisResult.warnings.map((warning, index) => (
                              <li key={index} className="text-red-700 text-sm flex items-start">
                                <span className="text-red-500 mr-2">•</span>
                                {warning}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-green-700 mb-3">💡 Recommendations</h3>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <ul className="space-y-2">
                            {analysisResult.recommendations.map((recommendation, index) => (
                              <li key={index} className="text-green-700 text-sm flex items-start">
                                <span className="text-green-500 mr-2">•</span>
                                {recommendation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* References */}
                  {analysisResult.references && analysisResult.references.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">📚 References</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <ul className="space-y-1">
                          {analysisResult.references.map((reference, index) => (
                            <li key={index} className="text-sm text-gray-600">
                              {index + 1}. {reference}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Features Description */}
        {!showResult && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Upload Workflow Features
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">📤 5-Step Process</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Select Image (file upload or camera)</li>
                    <li>• Validate (automatic quality checks)</li>
                    <li>• Edit (rotate, contrast, brightness)</li>
                    <li>• Process (OCR and AI analysis)</li>
                    <li>• Review (results and export options)</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">📱 Camera Features</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Live camera preview</li>
                    <li>• Auto-focus and exposure</li>
                    <li>• Real-time capture</li>
                    <li>• Permission handling</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">🎨 Image Editing</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 90° rotation controls</li>
                    <li>• Contrast adjustment (50-200%)</li>
                    <li>• Brightness control (50-200%)</li>
                    <li>• Saturation tuning (0-200%)</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">✅ Smart Validation</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• File size limits (10MB max)</li>
                    <li>• Format validation (JPEG, PNG, WebP)</li>
                    <li>• Quality warnings and tips</li>
                    <li>• Progress tracking</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 