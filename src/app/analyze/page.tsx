'use client';

import { FileUpload } from '@/components/upload/FileUpload';
import { SearchBox } from '@/components/search/SearchBox';

export default function AnalyzePage() {
  return (
    <div className="min-h-screen bg-bg-main">
      {/* Hero Section */}
      <div className="container py-16 text-center">
        <h2 className="text-5xl font-extrabold text-text-dark leading-tight mb-4">
          AI Nutrition Scanning & Smart Analysis
        </h2>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-8">
          Upload nutrition label images or directly enter supplement names. AI will provide professional analysis for you.
        </p>
      </div>

      {/* Main Analysis Interface */}
      <section className="container py-16">
        <div className="card text-center">
          <h3 className="text-3xl font-bold text-text-dark mb-6">
            Upload & Analyze Your Supplements
          </h3>
          <p className="text-text-secondary mb-8">
            Choose between uploading an image or searching our database for instant analysis.
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center space-y-6 md:space-y-0 md:space-x-8">
            {/* Search Section */}
            <div className="w-full md:w-1/2">
              <SearchBox
                onSearch={(query) => {
                  console.log('Searching for:', query);
                  // TODO: Implement database search in Week 2
                }}
                suggestions={['Vitamin D3', 'Magnesium', 'Omega-3', 'Vitamin B12', 'Multivitamin', 'Probiotics']}
                placeholder="e.g., Vitamin C or Pure Encapsulations"
                autoFocus={false}
                className="w-full"
              />
            </div>
            
            {/* Upload Section */}
            <div className="w-full md:w-1/2">
              <FileUpload
                onUpload={(file) => {
                  console.log('File uploaded:', file.name);
                  // TODO: Implement OCR processing in Week 2
                }}
                maxSize={10 * 1024 * 1024} // 10MB
                acceptedTypes={['.jpg', '.jpeg', '.png', '.webp']}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sample Analysis Section */}
      <section className="container py-16">
        <div className="card">
          <h3 className="text-3xl font-bold text-text-dark mb-6">AI Analysis Example: Zinc</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-xl font-semibold mb-2">1. Basic Introduction</h4>
              <p className="text-text-secondary">
                Zinc is an essential mineral that plays multiple roles in the body. It is crucial for immune system function, protein synthesis, DNA repair, and wound healing.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">2. Main Benefits</h4>
              <ul className="text-text-secondary list-disc list-inside">
                <li>Enhance immunity</li>
                <li>Promote growth and development</li>
                <li>Maintain skin health</li>
                <li>Support metabolic functions</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">3. Recommended Daily Allowance (RDA)</h4>
              <p className="text-text-secondary">
                Adult males ≈ 11 mg/day; Adult females ≈ 8 mg/day (Source: NIH ODS)
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">4. Tolerable Upper Intake Level (UL)</h4>
              <p className="text-text-secondary">
                Adults ≈ 40 mg/day. Exceeding this amount may cause adverse reactions.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">5. Common Dietary Sources</h4>
              <p className="text-text-secondary">
                Oysters, red meat, poultry, beans, nuts, whole grains, and fortified cereals.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">6. Supplement Forms</h4>
              <p className="text-text-secondary">
                Zinc sulfate, zinc gluconate, zinc picolinate, and zinc citrate are common forms.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">7. Who Should Consider Zinc</h4>
              <p className="text-text-secondary">
                Vegetarians, pregnant women, people with digestive disorders, and those with frequent infections.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-2">8. Risks & Precautions</h4>
              <p className="text-text-secondary">
                High doses can interfere with copper absorption, cause nausea, and suppress immune function.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Instructions */}
      <section className="container py-16">
        <div className="card text-center">
          <h3 className="text-3xl font-bold text-text-dark mb-6">How it works</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-vibrant-start rounded-full flex items-center justify-center text-white text-2xl font-bold">
                1
              </div>
              <h4 className="text-lg font-semibold mb-2">Upload or Search</h4>
              <p className="text-text-secondary">
                Upload a supplement label image or search our curated database of popular supplements.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-vibrant-end rounded-full flex items-center justify-center text-white text-2xl font-bold">
                2
              </div>
              <h4 className="text-lg font-semibold mb-2">AI Analysis</h4>
              <p className="text-text-secondary">
                Our AI analyzes ingredients, dosages, and provides comprehensive nutritional insights.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-purple-start rounded-full flex items-center justify-center text-white text-2xl font-bold">
                3
              </div>
              <h4 className="text-lg font-semibold mb-2">Get Results</h4>
              <p className="text-text-secondary">
                Receive detailed analysis including benefits, dosage, safety, and personalized recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Medical Disclaimer */}
      <section className="container py-8">
        <div className="bg-gray-50 p-6 rounded-xl">
          <p className="text-sm text-text-secondary text-center">
            <strong>Medical Disclaimer:</strong> This analysis is for educational purposes only and does not constitute medical advice. 
            Always consult with a healthcare provider before starting any supplement regimen, especially if you have medical conditions or take medications.
          </p>
        </div>
      </section>
    </div>
  );
} 