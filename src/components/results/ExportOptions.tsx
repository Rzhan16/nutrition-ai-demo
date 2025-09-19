'use client';

import React from 'react';
import { X, Download, FileText, Table } from 'lucide-react';
import type { Supplement } from '@/lib/types';

interface ExportOptionsProps {
  supplements: Supplement[];
  onClose: () => void;
}

export function ExportOptions({ supplements, onClose }: ExportOptionsProps) {
  const exportToPDF = () => {
    // TODO: Implement PDF export
    console.log('Exporting to PDF...', supplements);
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Brand', 'Category', 'Verified'];
    const csvContent = [
      headers.join(','),
      ...supplements.map(s => [
        `"${s.name}"`,
        `"${s.brand}"`,
        `"${s.category}"`,
        s.verified ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplements.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Export Results</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={exportToPDF}
            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 mr-3 text-red-500" />
              <div>
                <div className="font-medium">Export as PDF</div>
                <div className="text-sm text-gray-500">Formatted report with images</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400" />
          </button>

          <button
            onClick={exportToCSV}
            className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center">
              <Table className="w-5 h-5 mr-3 text-green-500" />
              <div>
                <div className="font-medium">Export as CSV</div>
                <div className="text-sm text-gray-500">Spreadsheet-compatible format</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="mt-4 pt-4 border-t text-sm text-gray-500">
          Exporting {supplements.length} supplement{supplements.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
} 