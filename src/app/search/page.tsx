'use client';

import React, { useState, useCallback } from 'react';
import { SearchInterface } from '@/components/search/SearchInterface';
import { ResultsDisplay } from '@/components/results/ResultsDisplay';
import { searchService } from '@/lib/search';
import type { Supplement, SearchFilters } from '@/lib/types';

export default function SearchPage() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({});

  const handleSearch = useCallback(async (
    query: string, 
    filters?: SearchFilters, 
    page: number = 1,
    append: boolean = false
  ) => {
    setLoading(true);
    try {
      const result = await searchService.searchSupplements(
        query,
        filters,
        { page, limit: 20, sortBy: 'relevance', sortOrder: 'desc' }
      );

      if (append) {
        setSupplements(prev => [...prev, ...result.supplements]);
      } else {
        setSupplements(result.supplements);
      }

      setTotalCount(result.totalCount);
      setHasMore(result.supplements.length === 20 && result.totalCount > page * 20);
      setCurrentPage(page);
      setCurrentQuery(query);
      setCurrentFilters(filters || {});
    } catch (error) {
      console.error('Search error:', error);
      setSupplements([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      handleSearch(currentQuery, currentFilters, currentPage + 1, true);
    }
  }, [hasMore, loading, currentQuery, currentFilters, currentPage, handleSearch]);

  const handleSupplementSelect = useCallback((supplement: Supplement) => {
    console.log('Selected supplement:', supplement);
    // Could navigate to a detail page or show more info
  }, []);

  const handleError = useCallback((error: string) => {
    console.error('Search interface error:', error);
    // Could show a toast notification
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Advanced Supplement Search
            </h1>
            <p className="text-lg text-gray-600">
              Search, filter, and discover supplements with AI-powered insights
            </p>
          </div>

          {/* Features Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-blue-600 font-semibold mb-1">🎙️ Voice Search</div>
              <div className="text-sm text-gray-600">Click the microphone to search by voice</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-green-600 font-semibold mb-1">📱 Barcode Scanner</div>
              <div className="text-sm text-gray-600">Scan product barcodes with your camera</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-purple-600 font-semibold mb-1">🔍 Smart Filters</div>
              <div className="text-sm text-gray-600">Filter by brand, category, and verification</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Interface */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <SearchInterface
          onResultSelect={handleSupplementSelect}
          onError={handleError}
          showBarcode={true}
          showVoiceSearch={true}
          className="mb-8"
        />

        {/* Results Display */}
        {(supplements.length > 0 || loading) && (
          <ResultsDisplay
            supplements={supplements}
            loading={loading}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onSupplementSelect={handleSupplementSelect}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            totalCount={totalCount}
            className="mt-8"
          />
        )}

        {/* Getting Started Instructions */}
        {supplements.length === 0 && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              How to Use Advanced Search
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="space-y-2">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-2xl">🔍</span>
                </div>
                <h3 className="font-medium">Text Search</h3>
                <p className="text-sm text-gray-600">
                  Type supplement names, brands, or ingredients
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-2xl">🎙️</span>
                </div>
                <h3 className="font-medium">Voice Search</h3>
                <p className="text-sm text-gray-600">
                  Click the microphone and speak your search
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-2xl">📱</span>
                </div>
                <h3 className="font-medium">Barcode Scan</h3>
                <p className="text-sm text-gray-600">
                  Use your camera to scan product barcodes
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto">
                  <span className="text-2xl">⚙️</span>
                </div>
                <h3 className="font-medium">Smart Filters</h3>
                <p className="text-sm text-gray-600">
                  Filter results by brand, category, and more
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-gray-600">Try searching for:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Vitamin D', 'Magnesium', 'Omega-3', 'Protein Powder', 'Multivitamin'].map((term) => (
                  <button
                    key={term}
                    onClick={() => handleSearch(term)}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors text-sm"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 