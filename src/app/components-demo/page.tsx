'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { NutrientInfo, type NutrientData } from '@/components/analysis/NutrientInfo';
import { WarningBanner, WarningBannerGroup, type WarningData } from '@/components/analysis/WarningBanner';
import { ReferenceLinks, type ReferenceData } from '@/components/analysis/ReferenceLinks';
import { Sidebar } from '@/components/layout/Sidebar';
import { 
  CardSkeleton, 
  AnalysisResultSkeleton, 
  SearchResultsSkeleton,
  Spinner
} from '@/components/layout/Loading';

// Sample data for demonstrations
const sampleNutrient: NutrientData = {
  id: 'vitamin-d3',
  name: 'Vitamin D3 (Cholecalciferol)',
  aliases: ['Cholecalciferol', 'Vitamin D₃'],
  amount: 5000,
  unit: 'IU',
  rda: {
    amount: 600,
    unit: 'IU',
    ageGroup: 'Adults 19-70',
    gender: 'both'
  },
  upperLimit: {
    amount: 4000,
    unit: 'IU'
  },
  dailyValuePercent: 833,
  bioavailability: 8,
  category: 'vitamin',
  safetyLevel: 'moderate',
  benefits: [
    'Supports bone health and calcium absorption',
    'Enhances immune system function',
    'May reduce risk of respiratory infections',
    'Supports muscle strength and balance',
    'May improve mood and reduce depression risk'
  ],
  risks: [
    'High doses may cause kidney stones',
    'Can increase calcium absorption leading to hypercalcemia',
    'May interact with certain medications'
  ],
  foodSources: [
    'Fatty fish (salmon, mackerel)',
    'Fortified milk and cereals',
    'Egg yolks',
    'Mushrooms',
    'Sunlight exposure'
  ],
  synergies: ['Vitamin K2', 'Magnesium', 'Calcium'],
  conflicts: ['Thiazide diuretics', 'High-dose calcium']
};

const sampleWarnings: WarningData[] = [
  {
    id: '1',
    title: 'Drug Interaction Warning',
    message: 'This supplement may interact with blood thinning medications (warfarin, heparin). Monitor INR levels closely and consult your healthcare provider.',
    severity: 'danger',
    category: 'interaction',
    dismissible: false,
    links: [
      {
        label: 'NIH Drug Interaction Database',
        url: 'https://www.nlm.nih.gov/medlineplus/druginfo/',
        external: true
      }
    ],
    emergency: {
      message: 'If experiencing unusual bleeding or bruising, contact emergency services immediately.',
      phone: '911'
    }
  },
  {
    id: '2',
    title: 'Dosage Exceeds Upper Limit',
    message: 'The recommended dosage (5000 IU) exceeds the tolerable upper intake level (4000 IU). Consider reducing dosage or consulting a healthcare provider.',
    severity: 'warning',
    category: 'dosage',
    dismissible: true
  },
  {
    id: '3',
    title: 'Pregnancy Considerations',
    message: 'High doses of Vitamin D during pregnancy may cause developmental issues. Pregnant women should not exceed 600 IU daily without medical supervision.',
    severity: 'critical',
    category: 'pregnancy',
    dismissible: false
  }
];

const sampleReferences: ReferenceData[] = [
  {
    id: '1',
    title: 'Vitamin D and Health',
    source: 'New England Journal of Medicine',
    authors: ['Holick, M.F.', 'Chen, T.C.'],
    date: '2023-03-15',
    doi: '10.1056/NEJMra070553',
    url: 'https://www.nejm.org/doi/full/10.1056/NEJMra070553',
    type: 'journal',
    credibilityScore: 9,
    accessLevel: 'subscription',
    description: 'Comprehensive review of vitamin D metabolism, health benefits, and deficiency risks.'
  },
  {
    id: '2',
    title: 'Vitamin D Fact Sheet for Health Professionals',
    source: 'National Institutes of Health Office of Dietary Supplements',
    date: '2023-08-12',
    url: 'https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/',
    type: 'government',
    credibilityScore: 10,
    accessLevel: 'free',
    description: 'Evidence-based information on vitamin D requirements, sources, and health effects.'
  },
  {
    id: '3',
    title: 'Vitamin D supplementation for prevention of mortality in adults',
    source: 'Cochrane Database of Systematic Reviews',
    authors: ['Bjelakovic, G.', 'Gluud, L.L.', 'Nikolova, D.'],
    date: '2023-01-10',
    doi: '10.1002/14651858.CD007470.pub3',
    url: 'https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD007470.pub3/full',
    type: 'clinical-study',
    studyType: 'meta-analysis',
    sampleSize: 95286,
    credibilityScore: 9,
    accessLevel: 'subscription'
  }
];

export default function ComponentsDemoPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  return (
    <div className="min-h-screen bg-bg-main">
      {/* Hero */}
      <div className="bg-gradient-to-br from-vibrant-start/10 to-vibrant-end/10 py-16">
        <div className="container text-center">
          <motion.h1 
            className="text-4xl font-bold text-text-dark mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            🧬 UI Component Library Demo
          </motion.h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Explore all the professional components built for the AI Nutrition Platform. 
            This showcases the complete component library including layout, analysis, and loading states.
          </p>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Demo */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
          onRecentSearchClick={(query) => console.log('Search:', query)}
          showRecentSearches
        />

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-12">
            
            {/* Controls */}
            <div className="card p-6">
              <h2 className="text-2xl font-bold mb-4">🎛️ Demo Controls</h2>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="btn-vibrant"
                >
                  {sidebarOpen ? 'Hide' : 'Show'} Sidebar
                </button>
                <button
                  onClick={() => setShowDetailed(!showDetailed)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  {showDetailed ? 'Hide' : 'Show'} Detailed Views
                </button>
                <button
                  onClick={() => setShowLoading(!showLoading)}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  {showLoading ? 'Hide' : 'Show'} Loading States
                </button>
              </div>
              {selectedCategory && (
                <p className="mt-4 text-sm text-text-secondary">
                  Selected Category: <strong>{selectedCategory}</strong>
                </p>
              )}
            </div>

            {/* Warning Banners Demo */}
            <section>
              <h2 className="text-2xl font-bold mb-6">⚠️ Warning System</h2>
              <WarningBannerGroup
                warnings={sampleWarnings}
                animate
                onDismiss={(id) => console.log('Dismissed warning:', id)}
              />
            </section>

            {/* Nutrient Info Demo */}
            <section>
              <h2 className="text-2xl font-bold mb-6">🧬 Nutrient Analysis Display</h2>
              <NutrientInfo
                nutrient={sampleNutrient}
                detailed={showDetailed}
                animate
                onInteraction={(action, id) => console.log('Nutrient action:', action, id)}
              />
            </section>

            {/* References Demo */}
            <section>
              <h2 className="text-2xl font-bold mb-6">📚 Academic References</h2>
              <ReferenceLinks
                references={sampleReferences}
                detailed={showDetailed}
                animate
                sortBy="credibility"
              />
            </section>

            {/* Loading States Demo */}
            {showLoading && (
              <section>
                <h2 className="text-2xl font-bold mb-6">📊 Loading States</h2>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Card Skeleton</h3>
                    <CardSkeleton />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Analysis Result Skeleton</h3>
                    <AnalysisResultSkeleton />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Search Results Skeleton</h3>
                    <SearchResultsSkeleton count={3} />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Loading Spinner</h3>
                    <div className="card p-8">
                      <Spinner message="Analyzing supplement data..." />
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Component Features */}
            <section>
              <h2 className="text-2xl font-bold mb-6">✨ Component Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-6">
                  <h3 className="text-lg font-semibold mb-3">🎨 Design Features</h3>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    <li>✅ Framer Motion animations</li>
                    <li>✅ Radix UI primitives</li>
                    <li>✅ Professional medical styling</li>
                    <li>✅ Mobile-first responsive</li>
                    <li>✅ Dark/light mode ready</li>
                  </ul>
                </div>
                
                <div className="card p-6">
                  <h3 className="text-lg font-semibold mb-3">♿ Accessibility</h3>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    <li>✅ ARIA labels and roles</li>
                    <li>✅ Keyboard navigation</li>
                    <li>✅ Screen reader support</li>
                    <li>✅ Focus management</li>
                    <li>✅ Color contrast compliance</li>
                  </ul>
                </div>
                
                <div className="card p-6">
                  <h3 className="text-lg font-semibold mb-3">📋 TypeScript</h3>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    <li>✅ Comprehensive interfaces</li>
                    <li>✅ JSDoc documentation</li>
                    <li>✅ Strict type checking</li>
                    <li>✅ Error handling</li>
                    <li>✅ Optional props</li>
                  </ul>
                </div>
                
                <div className="card p-6">
                  <h3 className="text-lg font-semibold mb-3">🔧 Functionality</h3>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    <li>✅ Loading and empty states</li>
                    <li>✅ Error boundaries</li>
                    <li>✅ Interactive animations</li>
                    <li>✅ Medical compliance</li>
                    <li>✅ Professional citations</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Usage Examples */}
            <section>
              <h2 className="text-2xl font-bold mb-6">💡 Usage Examples</h2>
              <div className="card p-6">
                <h3 className="text-lg font-semibold mb-4">Code Examples</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">NutrientInfo Component:</h4>
                    <pre className="bg-gray-100 p-3 rounded overflow-x-auto">
{`<NutrientInfo 
  nutrient={vitaminD3Data}
  detailed={true}
  animate={true}
  onInteraction={(action, id) => handleNutrientAction(action, id)}
/>`}
                    </pre>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Warning Banner:</h4>
                    <pre className="bg-gray-100 p-3 rounded overflow-x-auto">
{`<WarningBanner 
  warning={{
    title: "Drug Interaction Warning",
    severity: "danger",
    category: "interaction",
    message: "May interact with blood thinners"
  }}
  onDismiss={(id) => handleDismiss(id)}
/>`}
                    </pre>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
} 