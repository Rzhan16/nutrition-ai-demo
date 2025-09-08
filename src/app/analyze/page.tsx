'use client';

import { Upload, Search, Zap, Shield, Brain } from 'lucide-react';
import { FileUpload } from '@/components/upload/FileUpload';
import { SearchBox } from '@/components/search/SearchBox';

export default function AnalyzePage() {
  return (
    <div className="min-h-screen bg-bg-section">
      {/* Header Section */}
      <section className="px-6 pt-20 pb-16 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-text-dark sm:text-5xl">
            AI Supplement Analysis
          </h1>
          <p className="mt-6 text-lg leading-8 text-text-light">
            Upload supplement labels or search our database for instant AI-powered nutritional analysis.
            Get comprehensive insights backed by scientific research.
          </p>
        </div>
      </section>

      {/* Main Analysis Interface */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            
            {/* Upload Section */}
            <div className="medical-card p-8">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-primary-100 mb-6">
                  <Upload className="h-8 w-8 text-primary-600" />
                </div>
                <h2 className="text-2xl font-bold text-text-dark mb-4">
                  Upload Supplement Label
                </h2>
                <p className="text-text-light mb-6">
                  Take a photo or upload an image of your supplement label for instant OCR scanning and analysis.
                </p>
                
                {/* Upload Component */}
                <FileUpload
                  onUpload={(file) => {
                    console.log('File uploaded:', file.name);
                    // TODO: Implement OCR processing in Week 2
                  }}
                  maxSize={10 * 1024 * 1024} // 10MB
                  acceptedTypes={['.jpg', '.jpeg', '.png', '.webp']}
                />
              </div>
            </div>

            {/* Search Section */}
            <div className="medical-card p-8">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-health-100 mb-6">
                  <Search className="h-8 w-8 text-health-600" />
                </div>
                <h2 className="text-2xl font-bold text-text-dark mb-4">
                  Search Supplements
                </h2>
                <p className="text-text-light mb-6">
                  Search our database of popular supplements from trusted brands for instant analysis.
                </p>
                
                {/* Search Component */}
                <SearchBox
                  onSearch={(query) => {
                    console.log('Searching for:', query);
                    // TODO: Implement database search in Week 2
                  }}
                  suggestions={['Vitamin D3', 'Magnesium', 'Omega-3', 'Vitamin B12', 'Multivitamin', 'Probiotics']}
                  placeholder="Search supplements, brands, or ingredients..."
                  autoFocus={false}
                />
              </div>
            </div>
          </div>

          {/* Features Bar */}
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex items-center justify-center p-4 bg-bg-card rounded-lg shadow-sm border">
              <Zap className="h-6 w-6 text-status-warning mr-3" />
              <div>
                <div className="font-medium text-text-dark">Instant Results</div>
                <div className="text-sm text-text-light">Analysis in seconds</div>
              </div>
            </div>
            
            <div className="flex items-center justify-center p-4 bg-bg-card rounded-lg shadow-sm border">
              <Brain className="h-6 w-6 text-primary-600 mr-3" />
              <div>
                <div className="font-medium text-text-dark">AI-Powered</div>
                <div className="text-sm text-text-light">GPT-4 analysis</div>
              </div>
            </div>
            
            <div className="flex items-center justify-center p-4 bg-bg-card rounded-lg shadow-sm border">
              <Shield className="h-6 w-6 text-status-success mr-3" />
              <div>
                <div className="font-medium text-text-dark">Evidence-Based</div>
                <div className="text-sm text-text-light">NIH & Health Canada</div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-12 medical-card p-8">
            <h3 className="text-xl font-bold text-text-dark mb-6">How it works</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 font-bold text-lg mb-4">
                  1
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Upload or Search</h4>
                <p className="text-sm text-gray-600">
                  Upload a supplement label image or search our curated database of popular supplements.
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 text-green-600 font-bold text-lg mb-4">
                  2
                </div>
                <h4 className="font-medium text-gray-900 mb-2">AI Analysis</h4>
                <p className="text-sm text-gray-600">
                  Our AI analyzes ingredients, dosages, and provides comprehensive nutritional insights.
                </p>
              </div>
              
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 text-purple-600 font-bold text-lg mb-4">
                  3
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Get Results</h4>
                <p className="text-sm text-gray-600">
                  Receive detailed analysis including benefits, dosage, safety, and personalized recommendations.
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <Shield className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Medical Disclaimer:</strong> This analysis is for educational purposes only and does not constitute medical advice. 
                  Always consult with a healthcare provider before starting any supplement regimen, especially if you have medical conditions or take medications.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
} 