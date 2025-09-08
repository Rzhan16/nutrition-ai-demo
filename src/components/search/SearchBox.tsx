'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { cn, debounce } from '@/lib/utils';

/**
 * Props interface for SearchBox component
 * Follows .cursorrules TypeScript standards with comprehensive types
 */
export interface SearchProps {
  /** Callback fired when search is triggered */
  onSearch: (query: string) => void;
  /** Array of search suggestions to display */
  suggestions?: string[];
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the search is disabled */
  disabled?: boolean;
  /** Whether to autofocus the input on mount */
  autoFocus?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Loading state for search operation */
  loading?: boolean;
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
  /** Debounce delay in milliseconds */
  debounceDelay?: number;
}

/**
 * Suggestion item interface for search history and recommendations
 */
interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'suggestion' | 'trending';
  frequency?: number;
}

/**
 * Medical-grade search component with auto-complete and accessibility
 * Implements .cursorrules UX standards for supplement database search
 * 
 * @example
 * ```tsx
 * <SearchBox
 *   onSearch={(query) => console.log('Searching for:', query)}
 *   suggestions={['Vitamin D3', 'Magnesium', 'Omega-3']}
 *   placeholder="Search supplements, brands, or ingredients..."
 *   autoFocus
 * />
 * ```
 */
export function SearchBox({
  onSearch,
  suggestions = [],
  placeholder = 'Search supplements...',
  disabled = false,
  autoFocus = false,
  className,
  loading = false,
  maxSuggestions = 8,
  debounceDelay = 300,
}: SearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const searchId = React.useId();

  // Popular supplements for trending suggestions
  const trendingSuggestions: SearchSuggestion[] = [
    { id: '1', text: 'Vitamin D3', type: 'trending', frequency: 95 },
    { id: '2', text: 'Magnesium', type: 'trending', frequency: 87 },
    { id: '3', text: 'Omega-3', type: 'trending', frequency: 82 },
    { id: '4', text: 'Vitamin B12', type: 'trending', frequency: 78 },
    { id: '5', text: 'Probiotics', type: 'trending', frequency: 72 },
    { id: '6', text: 'Multivitamin', type: 'trending', frequency: 68 },
  ];

  /**
   * Debounced search function following .cursorrules performance standards
   */
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      if (searchQuery.trim()) {
        onSearch(searchQuery.trim());
      }
    }, debounceDelay),
    [onSearch, debounceDelay]
  );

  /**
   * Processes search suggestions with filtering and ranking
   * Implements .cursorrules data validation requirements
   */
  const getFilteredSuggestions = useCallback((): SearchSuggestion[] => {
    if (!query.trim()) {
      // Show recent searches and trending when no query
      const recentSearches = searchHistory.slice(0, 3);
      const trending = trendingSuggestions.slice(0, maxSuggestions - recentSearches.length);
      return [...recentSearches, ...trending];
    }

    const queryLower = query.toLowerCase();
    const filtered: SearchSuggestion[] = [];

    // Add matching suggestions from props
    suggestions.forEach((suggestion, index) => {
      if (suggestion.toLowerCase().includes(queryLower)) {
        filtered.push({
          id: `suggestion-${index}`,
          text: suggestion,
          type: 'suggestion',
        });
      }
    });

    // Add matching history items
    searchHistory.forEach((item) => {
      if (item.text.toLowerCase().includes(queryLower) && 
          !filtered.some(f => f.text.toLowerCase() === item.text.toLowerCase())) {
        filtered.push(item);
      }
    });

    // Add matching trending items
    trendingSuggestions.forEach((item) => {
      if (item.text.toLowerCase().includes(queryLower) && 
          !filtered.some(f => f.text.toLowerCase() === item.text.toLowerCase())) {
        filtered.push(item);
      }
    });

    return filtered.slice(0, maxSuggestions);
  }, [query, suggestions, searchHistory, maxSuggestions]);

  const filteredSuggestions = getFilteredSuggestions();

  /**
   * Handles input change with validation and debouncing
   * Follows .cursorrules input validation standards
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setActiveSuggestionIndex(-1);
    
    // Show suggestions when typing
    if (value.trim() || !isOpen) {
      setIsOpen(true);
    }

    // Trigger debounced search
    if (value.trim()) {
      debouncedSearch(value);
    }
  }, [debouncedSearch, isOpen]);

  /**
   * Executes search and updates history
   * Implements .cursorrules user experience standards
   */
  const executeSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const trimmedQuery = searchQuery.trim();
    setQuery(trimmedQuery);
    setIsOpen(false);
    setActiveSuggestionIndex(-1);

    // Add to search history (avoid duplicates)
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.text.toLowerCase() !== trimmedQuery.toLowerCase());
      const newItem: SearchSuggestion = {
        id: `history-${Date.now()}`,
        text: trimmedQuery,
        type: 'history',
        frequency: 1,
      };
      return [newItem, ...filtered].slice(0, 10); // Keep last 10 searches
    });

    onSearch(trimmedQuery);
  }, [onSearch]);

  /**
   * Handles keyboard navigation for accessibility
   * Implements .cursorrules accessibility requirements
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredSuggestions.length === 0) {
      if (e.key === 'Enter') {
        executeSearch(query);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (activeSuggestionIndex >= 0) {
          executeSearch(filteredSuggestions[activeSuggestionIndex].text);
        } else {
          executeSearch(query);
        }
        break;
      
      case 'Escape':
        setIsOpen(false);
        setActiveSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
      
      case 'Tab':
        setIsOpen(false);
        setActiveSuggestionIndex(-1);
        break;
    }
  }, [isOpen, filteredSuggestions, activeSuggestionIndex, executeSearch, query]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setIsOpen(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus();
  }, []);

  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    executeSearch(suggestion.text);
  }, [executeSearch]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listboxRef.current && !listboxRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load search history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nutrition-search-history');
      if (saved) {
        setSearchHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }, []);

  // Save search history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nutrition-search-history', JSON.stringify(searchHistory));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }, [searchHistory]);

  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'history':
        return <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />;
      case 'trending':
        return <TrendingUp className="h-4 w-4 text-primary-500" aria-hidden="true" />;
      default:
        return <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />;
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Search input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
          )}
        </div>
        
        <input
          ref={inputRef}
          id={searchId}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled || loading}
          autoFocus={autoFocus}
          autoComplete="off"
          className={cn(
            'block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg',
            'focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            'text-gray-900 placeholder-gray-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors duration-200'
          )}
          aria-label="Search supplements, brands, or ingredients"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={
            activeSuggestionIndex >= 0 
              ? `${searchId}-option-${activeSuggestionIndex}`
              : undefined
          }
          role="combobox"
        />
        
        {query && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 transition-colors"
            aria-label="Clear search"
            disabled={disabled || loading}
          >
            <X className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && (
        <div
          ref={listboxRef}
          className={cn(
            'absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg',
            'max-h-80 overflow-y-auto',
            'medical-card'
          )}
          role="listbox"
          aria-label="Search suggestions"
        >
          {filteredSuggestions.length > 0 ? (
            <>
              {!query.trim() && searchHistory.length > 0 && (
                <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">
                  Recent Searches
                </div>
              )}
              
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  id={`${searchId}-option-${index}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={cn(
                    'w-full px-3 py-3 text-left flex items-center space-x-3',
                    'hover:bg-gray-50 transition-colors',
                    'border-b border-gray-100 last:border-b-0',
                    activeSuggestionIndex === index && 'bg-primary-50 text-primary-900'
                  )}
                  role="option"
                  aria-selected={activeSuggestionIndex === index}
                >
                  {getSuggestionIcon(suggestion.type)}
                  <span className="flex-1 text-gray-900">{suggestion.text}</span>
                  {suggestion.type === 'trending' && suggestion.frequency && (
                    <span className="text-xs text-gray-500">
                      {suggestion.frequency}% popular
                    </span>
                  )}
                </button>
              ))}
              
              {!query.trim() && (
                <div className="px-3 py-2 text-xs text-gray-500 border-t">
                  Popular supplements from UBC community
                </div>
              )}
            </>
          ) : query.trim() ? (
            <div className="px-3 py-6 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                             <p className="text-sm">No suggestions found for &quot;{query}&quot;</p>
              <p className="text-xs mt-1">Try searching for supplement names, brands, or ingredients</p>
            </div>
          ) : (
            <div className="px-3 py-6 text-center text-gray-500">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-300" aria-hidden="true" />
              <p className="text-sm">Start typing to search supplements</p>
              <p className="text-xs mt-1">Popular: Vitamin D3, Magnesium, Omega-3</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 