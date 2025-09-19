'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  SlidersHorizontal,
  Mic,
  MicOff,
  Camera,
  Grid3X3,
  List,
  ArrowUpDown,
  Star,
  Clock,
  Heart,
  X,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchBox } from './SearchBox';
import { searchService } from '@/lib/search';
import { barcodeService } from '@/lib/barcode';
import type { 
  SearchFilters, 
  SearchResult as SearchResultType, 
  Supplement,
  BarcodeResult 
} from '@/lib/types';

interface SearchInterfaceProps {
  onResultSelect?: (supplement: Supplement) => void;
  onError?: (error: string) => void;
  className?: string;
  defaultQuery?: string;
  showBarcode?: boolean;
  showVoiceSearch?: boolean;
}

interface SearchHistory {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
}

interface VoiceSearchState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
}

export function SearchInterface({ 
  onResultSelect, 
  onError, 
  className = '',
  defaultQuery = '',
  showBarcode = true,
  showVoiceSearch = true
}: SearchInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [searchResults, setSearchResults] = useState<SearchResultType | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'relevance' | 'name' | 'brand' | 'popularity' | 'created'>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState<SearchFilters>({
    category: [],
    brand: [],
    verified: undefined,
    ingredients: []
  });

  // Voice search state
  const [voiceSearch, setVoiceSearch] = useState<VoiceSearchState>({
    isListening: false,
    isSupported: false,
    transcript: ''
  });

  // Search history
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Wishlist
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const barcodeVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize voice search
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setVoiceSearch(prev => ({ ...prev, isListening: true }));
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceSearch(prev => ({ ...prev, transcript }));
        setSearchQuery(transcript);
        performSearch(transcript);
      };

      recognition.onend = () => {
        setVoiceSearch(prev => ({ ...prev, isListening: false }));
      };

      recognition.onerror = (event) => {
        console.error('Voice recognition error:', event.error);
        setVoiceSearch(prev => ({ ...prev, isListening: false }));
        onError?.('Voice search failed: ' + event.error);
      };

      recognitionRef.current = recognition;
      setVoiceSearch(prev => ({ ...prev, isSupported: true }));
    }

    // Load search history from localStorage
    const savedHistory = localStorage.getItem('supplement-search-history');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setSearchHistory(history);
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    }

    // Load wishlist from localStorage
    const savedWishlist = localStorage.getItem('supplement-wishlist');
    if (savedWishlist) {
      try {
        setWishlist(new Set(JSON.parse(savedWishlist)));
      } catch (error) {
        console.error('Failed to load wishlist:', error);
      }
    }
  }, [onError]);

  // Perform search
  const performSearch = useCallback(async (query: string, page: number = 1) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setLoading(true);
    try {
      const result = await searchService.searchSupplements(
        query,
        filters,
        { page, limit: 20, sortBy, sortOrder }
      );
      
      setSearchResults(result);
      setCurrentPage(page);

      // Add to search history
      const historyEntry: SearchHistory = {
        id: Date.now().toString(),
        query,
        timestamp: new Date(),
        resultCount: result.totalCount
      };

      setSearchHistory(prev => {
        const updated = [historyEntry, ...prev.filter(h => h.query !== query)].slice(0, 10);
        localStorage.setItem('supplement-search-history', JSON.stringify(updated));
        return updated;
      });

    } catch (error) {
      console.error('Search error:', error);
      onError?.('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy, sortOrder, onError]);

  // Voice search handlers
  const startVoiceSearch = useCallback(() => {
    if (recognitionRef.current && voiceSearch.isSupported) {
      recognitionRef.current.start();
    }
  }, [voiceSearch.isSupported]);

  const stopVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Barcode search handlers
  const startBarcodeSearch = useCallback(async () => {
    try {
      setShowBarcodeScanner(true);
      await barcodeService.initializeScanner();
      
      barcodeService.startScanning(
        (result: BarcodeResult) => {
          if (result.productInfo?.name) {
            setSearchQuery(result.productInfo.name);
            performSearch(result.productInfo.name);
          }
          setShowBarcodeScanner(false);
        },
        (error: Error) => {
          onError?.('Barcode scanning failed: ' + error.message);
          setShowBarcodeScanner(false);
        }
      );
    } catch (error) {
      onError?.('Failed to start barcode scanner');
      setShowBarcodeScanner(false);
    }
  }, [performSearch, onError]);

  const stopBarcodeSearch = useCallback(() => {
    barcodeService.stopScanning();
    setShowBarcodeScanner(false);
  }, []);

  // Filter handlers
  const updateFilter = useCallback((key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      category: [],
      brand: [],
      verified: undefined,
      ingredients: []
    });
  }, []);

  // Wishlist handlers
  const toggleWishlist = useCallback((supplementId: string) => {
    setWishlist(prev => {
      const updated = new Set(prev);
      if (updated.has(supplementId)) {
        updated.delete(supplementId);
      } else {
        updated.add(supplementId);
      }
      localStorage.setItem('supplement-wishlist', JSON.stringify(Array.from(updated)));
      return updated;
    });
  }, []);

  // Pagination
  const handlePageChange = useCallback((page: number) => {
    performSearch(searchQuery, page);
  }, [searchQuery, performSearch]);

  return (
    <div className={`max-w-7xl mx-auto p-6 ${className}`}>
      {/* Search Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          {/* Main Search Box */}
          <div className="flex-1">
            <SearchBox
              onSearch={(query) => {
                setSearchQuery(query);
                performSearch(query);
              }}
              suggestions={searchResults?.suggestions || []}
              placeholder="Search supplements, brands, or ingredients..."
              loading={loading}
              className="w-full"
            />
          </div>

          {/* Voice Search */}
          {showVoiceSearch && voiceSearch.isSupported && (
            <button
              onClick={voiceSearch.isListening ? stopVoiceSearch : startVoiceSearch}
              className={`p-3 rounded-lg border transition-colors ${
                voiceSearch.isListening 
                  ? 'bg-red-500 text-white border-red-500' 
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              title={voiceSearch.isListening ? 'Stop voice search' : 'Start voice search'}
            >
              {voiceSearch.isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Barcode Scanner */}
          {showBarcode && (
            <button
              onClick={showBarcodeScanner ? stopBarcodeSearch : startBarcodeSearch}
              className={`p-3 rounded-lg border transition-colors ${
                showBarcodeScanner 
                  ? 'bg-blue-500 text-white border-blue-500' 
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              title="Scan barcode"
            >
              <Camera className="w-5 h-5" />
            </button>
          )}

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-lg border transition-colors ${
              showFilters 
                ? 'bg-blue-500 text-white border-blue-500' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
            title="Toggle filters"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Search Controls */}
        {searchResults && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {searchResults.totalCount} results {searchQuery && `for "${searchQuery}"`}
                {searchResults.searchTime && (
                  <span className="ml-1">({searchResults.searchTime}ms)</span>
                )}
              </span>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-1 border rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center space-x-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="relevance">Relevance</option>
                <option value="name">Name</option>
                <option value="brand">Brand</option>
                <option value="popularity">Popularity</option>
                <option value="created">Recently Added</option>
              </select>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 border rounded-lg hover:bg-gray-50"
                title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar with Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="w-80 space-y-6">
                {/* Search History */}
                {searchHistory.length > 0 && (
                  <div className="bg-white border rounded-lg p-4">
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <h3 className="font-medium">Recent Searches</h3>
                      {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    
                    <AnimatePresence>
                      {showHistory && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 space-y-2">
                            {searchHistory.slice(0, 5).map((item) => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setSearchQuery(item.query);
                                  performSearch(item.query);
                                }}
                                className="flex items-center justify-between w-full p-2 text-left hover:bg-gray-50 rounded text-sm"
                              >
                                <div className="flex items-center space-x-2">
                                  <Clock className="w-3 h-3 text-gray-400" />
                                  <span>{item.query}</span>
                                </div>
                                <span className="text-gray-400 text-xs">
                                  {item.resultCount} results
                                </span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Active Filters */}
                {(filters.category?.length || filters.brand?.length || filters.verified !== undefined) && (
                  <div className="bg-white border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">Active Filters</h3>
                      <button
                        onClick={clearFilters}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Clear All
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {filters.category?.map((category) => (
                        <div key={category} className="flex items-center justify-between bg-blue-50 px-2 py-1 rounded text-sm">
                          <span>Category: {category}</span>
                          <button
                            onClick={() => updateFilter('category', filters.category?.filter(c => c !== category))}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      
                      {filters.brand?.map((brand) => (
                        <div key={brand} className="flex items-center justify-between bg-green-50 px-2 py-1 rounded text-sm">
                          <span>Brand: {brand}</span>
                          <button
                            onClick={() => updateFilter('brand', filters.brand?.filter(b => b !== brand))}
                            className="text-green-600 hover:text-green-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      
                      {filters.verified !== undefined && (
                        <div className="flex items-center justify-between bg-purple-50 px-2 py-1 rounded text-sm">
                          <span>Verified: {filters.verified ? 'Yes' : 'No'}</span>
                          <button
                            onClick={() => updateFilter('verified', undefined)}
                            className="text-purple-600 hover:text-purple-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Filter Categories */}
                {searchResults?.facets.categories && searchResults.facets.categories.length > 0 && (
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-medium mb-3">Categories</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {searchResults.facets.categories.map((category) => (
                        <label key={category.value} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.category?.includes(category.value) || false}
                            onChange={(e) => {
                              const currentCategories = filters.category || [];
                              if (e.target.checked) {
                                updateFilter('category', [...currentCategories, category.value]);
                              } else {
                                updateFilter('category', currentCategories.filter(c => c !== category.value));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="flex-1">{category.value}</span>
                          <span className="text-gray-400">({category.count})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter Brands */}
                {searchResults?.facets.brands && searchResults.facets.brands.length > 0 && (
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-medium mb-3">Brands</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {searchResults.facets.brands.map((brand) => (
                        <label key={brand.value} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.brand?.includes(brand.value) || false}
                            onChange={(e) => {
                              const currentBrands = filters.brand || [];
                              if (e.target.checked) {
                                updateFilter('brand', [...currentBrands, brand.value]);
                              } else {
                                updateFilter('brand', currentBrands.filter(b => b !== brand.value));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="flex-1">{brand.value}</span>
                          <span className="text-gray-400">({brand.count})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verification Filter */}
                <div className="bg-white border rounded-lg p-4">
                  <h3 className="font-medium mb-3">Verification</h3>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 text-sm">
                      <input
                        type="radio"
                        name="verified"
                        checked={filters.verified === undefined}
                        onChange={() => updateFilter('verified', undefined)}
                      />
                      <span>All</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm">
                      <input
                        type="radio"
                        name="verified"
                        checked={filters.verified === true}
                        onChange={() => updateFilter('verified', true)}
                      />
                      <span>Verified Only</span>
                    </label>
                    <label className="flex items-center space-x-2 text-sm">
                      <input
                        type="radio"
                        name="verified"
                        checked={filters.verified === false}
                        onChange={() => updateFilter('verified', false)}
                      />
                      <span>Unverified Only</span>
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="flex-1">
          {/* Barcode Scanner Modal */}
          <AnimatePresence>
            {showBarcodeScanner && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              >
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Scan Barcode</h3>
                    <button
                      onClick={stopBarcodeSearch}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="bg-black rounded-lg overflow-hidden mb-4">
                    <video
                      ref={barcodeVideoRef}
                      className="w-full h-64 object-cover"
                      autoPlay
                      playsInline
                    />
                  </div>
                  
                  <p className="text-sm text-gray-600 text-center">
                    Position the barcode within the frame to scan
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-2 text-gray-600">Searching...</span>
            </div>
          )}

          {/* Search Results */}
          {searchResults && !loading && (
            <div className="space-y-6">
              {/* Results Grid/List */}
              {searchResults.supplements.length > 0 ? (
                <div className={`
                  ${viewMode === 'grid' 
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
                    : 'space-y-4'
                  }
                `}>
                  {searchResults.supplements.map((supplement) => (
                    <div
                      key={supplement.id}
                      className={`
                        bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer
                        ${viewMode === 'list' ? 'flex items-center space-x-4' : ''}
                      `}
                      onClick={() => onResultSelect?.(supplement)}
                    >
                      {supplement.imageUrl && (
                        <img
                          src={supplement.imageUrl}
                          alt={supplement.name}
                          className={`
                            object-cover rounded
                            ${viewMode === 'list' ? 'w-16 h-16' : 'w-full h-32 mb-3'}
                          `}
                        />
                      )}
                      
                      <div className={viewMode === 'list' ? 'flex-1' : ''}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-gray-900 line-clamp-2">
                            {supplement.name}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWishlist(supplement.id);
                            }}
                            className={`ml-2 ${
                              wishlist.has(supplement.id) 
                                ? 'text-red-500' 
                                : 'text-gray-400 hover:text-red-500'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${wishlist.has(supplement.id) ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-1">{supplement.brand}</p>
                        <p className="text-xs text-gray-500 mb-2">{supplement.category}</p>
                        
                        <div className="flex items-center justify-between">
                          {supplement.verified && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                              <Star className="w-3 h-3 mr-1" />
                              Verified
                            </span>
                          )}
                          
                          {supplement.relevanceScore && (
                            <span className="text-xs text-gray-500">
                              {Math.round(supplement.relevanceScore)}% match
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                  <p className="text-gray-600">
                    Try adjusting your search terms or filters
                  </p>
                </div>
              )}

              {/* Pagination */}
              {searchResults.supplements.length > 0 && searchResults.totalCount > 20 && (
                <div className="flex items-center justify-center space-x-2">
                  {Array.from(
                    { length: Math.min(Math.ceil(searchResults.totalCount / 20), 10) },
                    (_, i) => i + 1
                  ).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`
                        px-3 py-2 rounded border text-sm
                        ${page === currentPage 
                          ? 'bg-blue-500 text-white border-blue-500' 
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!searchResults && !loading && (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                Search for Supplements
              </h3>
              <p className="text-gray-600 mb-6">
                Find detailed information about vitamins, minerals, and other supplements
              </p>
              
              <div className="flex items-center justify-center space-x-4">
                {showVoiceSearch && voiceSearch.isSupported && (
                  <button
                    onClick={startVoiceSearch}
                    className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Voice Search
                  </button>
                )}
                
                {showBarcode && (
                  <button
                    onClick={startBarcodeSearch}
                    className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Scan Barcode
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Extend window interface for speech recognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
} 