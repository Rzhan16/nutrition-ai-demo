'use client';

import { useState } from 'react';
import { OCRProcessor } from '@/components/ocr/OCRProcessor';
import { OCRResult } from '@/lib/ocr';
import { BarcodeResult } from '@/lib/barcode';

export default function TestScannerPage() {
  const [result, setResult] = useState<OCRResult | BarcodeResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleResult = (scanResult: OCRResult | BarcodeResult) => {
    console.log('Scan result:', scanResult);
    setResult(scanResult);
    setError('');
  };

  const handleError = (errorMessage: string) => {
    console.error('Scan error:', errorMessage);
    setError(errorMessage);
    setResult(null);
  };

  const isOCRResult = (result: OCRResult | BarcodeResult): result is OCRResult => {
    return 'ingredients' in result;
  };

  const isBarcodeResult = (result: OCRResult | BarcodeResult): result is BarcodeResult => {
    return 'code' in result;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔬 OCR & Barcode Scanner Test
          </h1>
          <p className="text-gray-600">
            Test the new Week 2 features: OCR text extraction and barcode scanning
          </p>
        </div>

        {/* Feature Overview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">✨ New Features</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">🔍 Smart Scan</h3>
              <p className="text-blue-700">
                Automatically detects barcodes first, then falls back to OCR text extraction
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">📱 Barcode Scanner</h3>
              <p className="text-green-700">
                Supports UPC, EAN, Code 128, QR codes with database lookup
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-medium text-purple-900 mb-2">📝 OCR Engine</h3>
              <p className="text-purple-700">
                Tesseract.js with image preprocessing and ingredient parsing
              </p>
            </div>
          </div>
        </div>

        {/* Scanner Component */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">📷 Scanner Interface</h2>
          <OCRProcessor
            onResult={handleResult}
            onError={handleError}
            className="w-full"
          />
        </div>

        {/* Results Display */}
        {result && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">📊 Scan Results</h2>
            
            {isBarcodeResult(result) && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">📱 Barcode Detected</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Code:</span> {result.code}
                    </div>
                    <div>
                      <span className="font-medium">Format:</span> {result.format}
                    </div>
                    <div>
                      <span className="font-medium">Confidence:</span> {Math.round(result.confidence * 100)}%
                    </div>
                    <div>
                      <span className="font-medium">Timestamp:</span> {new Date(result.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {result.productInfo && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">🏷️ Product Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {result.productInfo.name && (
                        <div><span className="font-medium">Name:</span> {result.productInfo.name}</div>
                      )}
                      {result.productInfo.brand && (
                        <div><span className="font-medium">Brand:</span> {result.productInfo.brand}</div>
                      )}
                      {result.productInfo.category && (
                        <div><span className="font-medium">Category:</span> {result.productInfo.category}</div>
                      )}
                      {result.productInfo.description && (
                        <div className="col-span-full">
                          <span className="font-medium">Description:</span> {result.productInfo.description}
                        </div>
                      )}
                    </div>
                    {result.productInfo.ingredients && result.productInfo.ingredients.length > 0 && (
                      <div className="mt-2">
                        <span className="font-medium">Ingredients:</span>
                        <ul className="list-disc list-inside text-sm mt-1">
                          {result.productInfo.ingredients.map((ingredient, idx) => (
                            <li key={idx}>{ingredient}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {isOCRResult(result) && (
              <div className="space-y-4">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-medium text-purple-900 mb-2">📝 OCR Results</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="font-medium">Confidence:</span> {Math.round(result.confidence * 100)}%
                    </div>
                    <div>
                      <span className="font-medium">Processing Time:</span> {result.processingTime}ms
                    </div>
                    {result.brand && (
                      <div>
                        <span className="font-medium">Brand:</span> {result.brand}
                      </div>
                    )}
                    {result.productName && (
                      <div>
                        <span className="font-medium">Product:</span> {result.productName}
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-white p-3 rounded border">
                    <span className="font-medium">Extracted Text:</span>
                    <pre className="text-xs mt-2 whitespace-pre-wrap">{result.text}</pre>
                  </div>
                </div>

                {result.ingredients && result.ingredients.length > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">🧪 Parsed Ingredients</h4>
                    <div className="grid gap-2">
                      {result.ingredients.map((ingredient, idx) => (
                        <div key={idx} className="bg-white p-2 rounded text-sm">
                          <span className="font-medium">{ingredient.name}</span>
                          {ingredient.amount && ingredient.unit && (
                            <span className="text-gray-600 ml-2">
                              {ingredient.amount} {ingredient.unit}
                            </span>
                          )}
                          {ingredient.dailyValue && (
                            <span className="text-blue-600 ml-2">
                              ({ingredient.dailyValue} DV)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.warnings && result.warnings.length > 0 && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-2">⚠️ Warnings & Allergens</h4>
                    <ul className="list-disc list-inside text-sm">
                      {result.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <h3 className="font-medium text-red-900 mb-2">❌ Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Testing Instructions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">🧪 Testing Instructions</h2>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">📱 Barcode Testing:</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Use your phone camera to scan any supplement barcode</li>
                <li>Try UPC codes from vitamin bottles</li>
                <li>Test with QR codes for enhanced product info</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">📝 OCR Testing:</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Upload clear photos of supplement labels</li>
                <li>Try supplement facts panels with ingredients</li>
                <li>Test with different brands and formats</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">🎯 Smart Scan Testing:</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Upload images with both barcodes and text</li>
                <li>Watch the intelligent fallback from barcode to OCR</li>
                <li>Test manual text correction for low confidence results</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 