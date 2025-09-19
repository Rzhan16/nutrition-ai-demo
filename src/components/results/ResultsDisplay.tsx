'use client';

import React, { useState, useCallback } from 'react';
import { Grid3X3, List, Download, Share, Eye, GitCompare } from 'lucide-react';
import { GridView } from './GridView';
import { ListView } from './ListView';
import { QuickPreview } from './QuickPreview';
import { ComparisonView } from './ComparisonView';
import { ExportOptions } from './ExportOptions';
import { SocialShare } from './SocialShare';
import type { Supplement } from '@/lib/types';

interface ResultsDisplayProps {
  supplements: Supplement[];
  loading?: boolean;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  onSupplementSelect?: (supplement: Supplement) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  totalCount?: number;
  className?: string;
}

export function ResultsDisplay({
  supplements,
  loading = false,
  viewMode = 'grid',
  onViewModeChange,
  onSupplementSelect,
  onLoadMore,
  hasMore = false,
  totalCount,
  className = ''
}: ResultsDisplayProps) {
  const [selectedSupplement, setSelectedSupplement] = useState<Supplement | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set());
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const handleSupplementClick = useCallback((supplement: Supplement) => {
    setSelectedSupplement(supplement);
    setShowPreview(true);
    onSupplementSelect?.(supplement);
  }, [onSupplementSelect]);

  const handleComparisonToggle = useCallback((supplementId: string) => {
    setSelectedForComparison(prev => {
      const updated = new Set(prev);
      if (updated.has(supplementId)) {
        updated.delete(supplementId);
      } else {
        if (updated.size < 4) { // Limit to 4 items for comparison
          updated.add(supplementId);
        }
      }
      return updated;
    });
  }, []);

  const getSelectedSupplements = useCallback(() => {
    return supplements.filter(s => selectedForComparison.has(s.id));
  }, [supplements, selectedForComparison]);

  const handleExport = useCallback(() => {
    setShowExportOptions(true);
  }, []);

  const handleShare = useCallback(() => {
    setShowShareOptions(true);
  }, []);

  return (
    <div className={className}>
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 border rounded-lg p-1">
            <button
              onClick={() => onViewModeChange?.('grid')}
              className={`p-2 rounded ${
                viewMode === 'grid' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange?.('list')}
              className={`p-2 rounded ${
                viewMode === 'list' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Results Count */}
          {totalCount !== undefined && (
            <span className="text-sm text-gray-600">
              {totalCount} {totalCount === 1 ? 'result' : 'results'}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Comparison Toggle */}
          {selectedForComparison.size > 0 && (
            <button
              onClick={() => setShowComparison(true)}
              className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Compare ({selectedForComparison.size})
            </button>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            title="Export results"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            title="Share results"
          >
            <Share className="w-4 h-4 mr-2" />
            Share
          </button>
        </div>
      </div>

      {/* Results Content */}
      {viewMode === 'grid' ? (
        <GridView
          supplements={supplements}
          loading={loading}
          onSupplementClick={handleSupplementClick}
          onComparisonToggle={handleComparisonToggle}
          selectedForComparison={selectedForComparison}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
        />
      ) : (
        <ListView
          supplements={supplements}
          loading={loading}
          onSupplementClick={handleSupplementClick}
          onComparisonToggle={handleComparisonToggle}
          selectedForComparison={selectedForComparison}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
        />
      )}

      {/* Quick Preview Modal */}
      {showPreview && selectedSupplement && (
        <QuickPreview
          supplement={selectedSupplement}
          onClose={() => setShowPreview(false)}
          onAddToComparison={() => handleComparisonToggle(selectedSupplement.id)}
          isInComparison={selectedForComparison.has(selectedSupplement.id)}
        />
      )}

      {/* Comparison Modal */}
      {showComparison && selectedForComparison.size > 1 && (
        <ComparisonView
          supplements={getSelectedSupplements()}
          onClose={() => setShowComparison(false)}
          onRemoveFromComparison={handleComparisonToggle}
        />
      )}

      {/* Export Options Modal */}
      {showExportOptions && (
        <ExportOptions
          supplements={supplements}
          onClose={() => setShowExportOptions(false)}
        />
      )}

      {/* Share Options Modal */}
      {showShareOptions && (
        <SocialShare
          supplements={supplements}
          onClose={() => setShowShareOptions(false)}
        />
      )}
    </div>
  );
} 