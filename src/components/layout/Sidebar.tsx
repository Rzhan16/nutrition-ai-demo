'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Tag, 
  TrendingUp, 
  Heart,
  Brain,
  Shield,
  Zap,
  Search,
  X
} from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as Separator from '@radix-ui/react-separator';
import { cn } from '@/lib/utils';

/**
 * Category interface for supplement categories
 */
interface Category {
  /** Category identifier */
  id: string;
  /** Display name */
  name: string;
  /** Category icon */
  icon: React.ComponentType<{ className?: string }>;
  /** Number of items in category */
  count: number;
  /** Subcategories */
  subcategories?: Category[];
  /** Category color theme */
  color: string;
}

/**
 * Recent search interface
 */
interface RecentSearch {
  /** Search identifier */
  id: string;
  /** Search query */
  query: string;
  /** Search timestamp */
  timestamp: Date;
  /** Search type */
  type: 'supplement' | 'ingredient' | 'brand';
  /** Search results count */
  resultCount?: number;
}

/**
 * Props interface for Sidebar component
 */
export interface SidebarProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether sidebar is open (mobile) */
  isOpen?: boolean;
  /** Callback to close sidebar */
  onClose?: () => void;
  /** Current selected category */
  selectedCategory?: string;
  /** Category selection callback */
  onCategorySelect?: (categoryId: string) => void;
  /** Recent search click callback */
  onRecentSearchClick?: (query: string) => void;
  /** Whether to show recent searches */
  showRecentSearches?: boolean;
  /** Maximum number of recent searches to show */
  maxRecentSearches?: number;
}

/**
 * Supplement categories configuration
 */
const categories: Category[] = [
  {
    id: 'vitamins',
    name: 'Vitamins',
    icon: Zap,
    count: 156,
    color: 'text-orange-600 bg-orange-100',
    subcategories: [
      { id: 'vitamin-d', name: 'Vitamin D', icon: Zap, count: 24, color: 'text-orange-500' },
      { id: 'vitamin-b', name: 'B Complex', icon: Zap, count: 18, color: 'text-orange-500' },
      { id: 'vitamin-c', name: 'Vitamin C', icon: Zap, count: 12, color: 'text-orange-500' },
    ],
  },
  {
    id: 'minerals',
    name: 'Minerals',
    icon: Shield,
    count: 89,
    color: 'text-blue-600 bg-blue-100',
    subcategories: [
      { id: 'magnesium', name: 'Magnesium', icon: Shield, count: 16, color: 'text-blue-500' },
      { id: 'zinc', name: 'Zinc', icon: Shield, count: 14, color: 'text-blue-500' },
      { id: 'iron', name: 'Iron', icon: Shield, count: 12, color: 'text-blue-500' },
    ],
  },
  {
    id: 'cognitive',
    name: 'Cognitive Health',
    icon: Brain,
    count: 67,
    color: 'text-purple-600 bg-purple-100',
    subcategories: [
      { id: 'nootropics', name: 'Nootropics', icon: Brain, count: 28, color: 'text-purple-500' },
      { id: 'omega-3', name: 'Omega-3', icon: Brain, count: 22, color: 'text-purple-500' },
    ],
  },
  {
    id: 'heart-health',
    name: 'Heart Health',
    icon: Heart,
    count: 45,
    color: 'text-red-600 bg-red-100',
  },
  {
    id: 'immune',
    name: 'Immune Support',
    icon: Shield,
    count: 78,
    color: 'text-green-600 bg-green-100',
  },
];

/**
 * Mock recent searches data
 */
const mockRecentSearches: RecentSearch[] = [
  {
    id: '1',
    query: 'Vitamin D3 5000 IU',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    type: 'supplement',
    resultCount: 12,
  },
  {
    id: '2',
    query: 'Magnesium Glycinate',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    type: 'supplement',
    resultCount: 8,
  },
  {
    id: '3',
    query: 'Pure Encapsulations',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    type: 'brand',
    resultCount: 45,
  },
];

/**
 * Professional sidebar component with categories and recent searches
 * Implements accessibility and responsive design standards
 * 
 * @example
 * ```tsx
 * <Sidebar 
 *   isOpen={sidebarOpen}
 *   onClose={() => setSidebarOpen(false)}
 *   selectedCategory="vitamins"
 *   onCategorySelect={(id) => setSelectedCategory(id)}
 *   showRecentSearches
 * />
 * ```
 */
export function Sidebar({
  className,
  isOpen = false,
  onClose,
  selectedCategory,
  onCategorySelect,
  onRecentSearchClick,
  showRecentSearches = true,
  maxRecentSearches = 5,
}: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['vitamins']));

  const toggleCategory = useCallback((categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  }, [expandedCategories]);

  const handleCategoryClick = useCallback((categoryId: string) => {
    onCategorySelect?.(categoryId);
  }, [onCategorySelect]);

  const handleRecentSearchClick = useCallback((query: string) => {
    onRecentSearchClick?.(query);
    onClose?.(); // Close sidebar on mobile after selection
  }, [onRecentSearchClick, onClose]);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffMinutes / 1440)}d ago`;
    }
  };

  const sidebarClasses = cn(
    'bg-surface-white border-r border-border-light h-full flex flex-col',
    'w-80 fixed lg:relative lg:translate-x-0 z-40 transition-transform duration-300',
    isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    className
  );

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={sidebarClasses}
        initial={{ x: -320 }}
        animate={{ x: isOpen ? 0 : -320 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border-light">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-dark">Categories</h2>
            <button
              onClick={onClose}
              className="lg:hidden p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Categories Section */}
          <div className="p-4">
            <nav role="navigation" aria-label="Supplement categories">
              {categories.map((category) => {
                const isExpanded = expandedCategories.has(category.id);
                const isSelected = selectedCategory === category.id;
                const CategoryIcon = category.icon;

                return (
                  <Collapsible.Root
                    key={category.id}
                    open={isExpanded}
                    onOpenChange={() => toggleCategory(category.id)}
                  >
                    <div className="mb-2">
                      <div className="flex items-center">
                        <Collapsible.Trigger asChild>
                          <button
                            className="flex items-center justify-between w-full p-3 text-left rounded-lg hover:bg-gray-50 transition-colors group"
                            aria-expanded={isExpanded}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={cn('p-2 rounded-lg', category.color)}>
                                <CategoryIcon className="h-4 w-4" />
                              </div>
                              <div>
                                <span className={cn(
                                  'font-medium',
                                  isSelected ? 'text-vibrant-start' : 'text-text-dark'
                                )}>
                                  {category.name}
                                </span>
                                <div className="text-xs text-text-secondary">
                                  {category.count} items
                                </div>
                              </div>
                            </div>
                            {category.subcategories && (
                              <motion.div
                                animate={{ rotate: isExpanded ? 90 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronRight className="h-4 w-4 text-text-secondary" />
                              </motion.div>
                            )}
                          </button>
                        </Collapsible.Trigger>
                        
                        <button
                          onClick={() => handleCategoryClick(category.id)}
                          className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={`View ${category.name} category`}
                        >
                          <Tag className="h-4 w-4 text-text-secondary" />
                        </button>
                      </div>

                      {/* Subcategories */}
                      {category.subcategories && (
                        <Collapsible.Content>
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="ml-8 mt-2 space-y-1"
                          >
                            {category.subcategories.map((subcategory) => {
                              const SubIcon = subcategory.icon;
                              return (
                                <button
                                  key={subcategory.id}
                                  onClick={() => handleCategoryClick(subcategory.id)}
                                  className="flex items-center justify-between w-full p-2 text-left rounded hover:bg-gray-50 transition-colors group"
                                >
                                  <div className="flex items-center space-x-2">
                                    <SubIcon className={cn('h-3 w-3', subcategory.color)} />
                                    <span className="text-sm text-text-secondary group-hover:text-text-dark">
                                      {subcategory.name}
                                    </span>
                                  </div>
                                  <span className="text-xs text-text-secondary">
                                    {subcategory.count}
                                  </span>
                                </button>
                              );
                            })}
                          </motion.div>
                        </Collapsible.Content>
                      )}
                    </div>
                  </Collapsible.Root>
                );
              })}
            </nav>
          </div>

          {/* Recent Searches Section */}
          {showRecentSearches && (
            <>
              <Separator.Root className="mx-4 h-px bg-border-light" />
              
              <div className="p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Clock className="h-4 w-4 text-text-secondary" />
                  <h3 className="text-sm font-medium text-text-dark">Recent Searches</h3>
                </div>
                
                <div className="space-y-2">
                  {mockRecentSearches.slice(0, maxRecentSearches).map((search) => (
                    <button
                      key={search.id}
                      onClick={() => handleRecentSearchClick(search.query)}
                      className="w-full p-3 text-left rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Search className="h-3 w-3 text-text-secondary flex-shrink-0" />
                            <span className="text-sm font-medium text-text-dark truncate">
                              {search.query}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-text-secondary">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-xs',
                              search.type === 'supplement' && 'bg-blue-100 text-blue-700',
                              search.type === 'ingredient' && 'bg-green-100 text-green-700',
                              search.type === 'brand' && 'bg-purple-100 text-purple-700'
                            )}>
                              {search.type}
                            </span>
                            <span>{formatTimeAgo(search.timestamp)}</span>
                          </div>
                        </div>
                        {search.resultCount && (
                          <div className="flex items-center text-xs text-text-secondary ml-2">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {search.resultCount}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                
                {mockRecentSearches.length === 0 && (
                  <div className="text-center py-8">
                    <Search className="h-8 w-8 text-text-secondary mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">No recent searches</p>
                    <p className="text-xs text-text-secondary mt-1">
                      Start searching to see your history
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </motion.aside>
    </>
  );
} 