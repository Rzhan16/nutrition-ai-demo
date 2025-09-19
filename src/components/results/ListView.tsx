'use client';

import React from 'react';
import { InfiniteScroll } from './InfiniteScroll';
import type { Supplement } from '@/lib/types';

interface ListViewProps {
  supplements: Supplement[];
  loading?: boolean;
  onSupplementClick: (supplement: Supplement) => void;
  onComparisonToggle: (supplementId: string) => void;
  selectedForComparison: Set<string>;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function ListView({
  supplements,
  loading = false,
  onSupplementClick,
  onComparisonToggle,
  selectedForComparison,
  onLoadMore,
  hasMore = false
}: ListViewProps) {
  return (
    <InfiniteScroll onLoadMore={onLoadMore} hasMore={hasMore} loading={loading}>
      <div className="space-y-4">
        {supplements.map((supplement) => (
          <div
            key={supplement.id}
            className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center space-x-4"
            onClick={() => onSupplementClick(supplement)}
          >
            {supplement.imageUrl && (
              <img
                src={supplement.imageUrl}
                alt={supplement.name}
                className="w-16 h-16 object-cover rounded"
              />
            )}
            
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 mb-1">{supplement.name}</h3>
              <p className="text-sm text-gray-600 mb-1">{supplement.brand}</p>
              <p className="text-xs text-gray-500">{supplement.category}</p>
            </div>
            
            <div className="flex items-center space-x-2">
              {supplement.verified && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  Verified
                </span>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onComparisonToggle(supplement.id);
                }}
                className={`text-xs px-3 py-1 rounded ${
                  selectedForComparison.has(supplement.id)
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {selectedForComparison.has(supplement.id) ? 'Remove' : 'Compare'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </InfiniteScroll>
  );
} 