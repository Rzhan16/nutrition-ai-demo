'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { Supplement } from '@/lib/types';

interface ComparisonViewProps {
  supplements: Supplement[];
  onClose: () => void;
  onRemoveFromComparison: (id: string) => void;
}

export function ComparisonView({ supplements, onClose, onRemoveFromComparison }: ComparisonViewProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Compare Supplements</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4">Product</th>
                {supplements.map(supplement => (
                  <th key={supplement.id} className="text-center py-2 px-4 min-w-48">
                    <div className="relative">
                      <button
                        onClick={() => onRemoveFromComparison(supplement.id)}
                        className="absolute -top-2 -right-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {supplement.imageUrl && (
                        <img
                          src={supplement.imageUrl}
                          alt={supplement.name}
                          className="w-16 h-16 object-cover rounded mx-auto mb-2"
                        />
                      )}
                      <div className="text-sm font-medium">{supplement.name}</div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 px-4 font-medium">Brand</td>
                {supplements.map(supplement => (
                  <td key={supplement.id} className="py-2 px-4 text-center">{supplement.brand}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4 font-medium">Category</td>
                {supplements.map(supplement => (
                  <td key={supplement.id} className="py-2 px-4 text-center">{supplement.category}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 px-4 font-medium">Verified</td>
                {supplements.map(supplement => (
                  <td key={supplement.id} className="py-2 px-4 text-center">
                    {supplement.verified ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 