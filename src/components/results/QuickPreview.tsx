'use client';

import React from 'react';
import { X, Plus } from 'lucide-react';
import type { Supplement } from '@/lib/types';

interface QuickPreviewProps {
  supplement: Supplement;
  onClose: () => void;
  onAddToComparison: () => void;
  isInComparison: boolean;
}

export function QuickPreview({ supplement, onClose, onAddToComparison, isInComparison }: QuickPreviewProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{supplement.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {supplement.imageUrl && (
            <div>
              <img
                src={supplement.imageUrl}
                alt={supplement.name}
                className="w-full h-48 object-cover rounded"
              />
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">Brand</h3>
              <p className="text-gray-700">{supplement.brand}</p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900">Category</h3>
              <p className="text-gray-700">{supplement.category}</p>
            </div>

            {supplement.verified && (
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                Verified Product
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
          <button
            onClick={onAddToComparison}
            className={`flex items-center px-4 py-2 rounded-lg ${
              isInComparison
                ? 'bg-gray-200 text-gray-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <Plus className="w-4 h-4 mr-2" />
            {isInComparison ? 'In Comparison' : 'Add to Compare'}
          </button>
        </div>
      </div>
    </div>
  );
} 