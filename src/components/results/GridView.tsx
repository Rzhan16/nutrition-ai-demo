'use client';

/* eslint-disable @next/next/no-img-element */

import React from 'react';
import { InfiniteScroll } from './InfiniteScroll';
import type { Supplement } from '@/lib/types';

interface GridViewProps {
  supplements: Supplement[];
  loading?: boolean;
  onSupplementClick: (supplement: Supplement) => void;
  onComparisonToggle: (supplementId: string) => void;
  selectedForComparison: Set<string>;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function GridView({
  supplements,
  loading = false,
  onSupplementClick,
  onComparisonToggle,
  selectedForComparison,
  onLoadMore,
  hasMore = false
}: GridViewProps) {
  return (
    <InfiniteScroll onLoadMore={onLoadMore} hasMore={hasMore} loading={loading}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {supplements.map((supplement) => (
          <div
            key={supplement.id}
            className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onSupplementClick(supplement)}
          >
            {supplement.imageUrl ? (
              <img
                src={supplement.imageUrl}
                alt={supplement.name}
                className="w-full h-32 object-cover rounded mb-3"
              />
            ) : (
              <div className="w-full h-32 rounded mb-3 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                No image available
              </div>
            )}
            
            <h3 className="font-medium text-gray-900 line-clamp-2 mb-2">
              {supplement.name}
            </h3>
            
            <p className="text-sm text-gray-600 mb-1">{supplement.brand}</p>
            <p className="text-xs text-gray-500 mb-2">{supplement.category}</p>
            
            <div className="flex items-center justify-between">
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
                className={`text-xs px-2 py-1 rounded ${
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
