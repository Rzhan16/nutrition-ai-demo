'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props interface for AnalysisCard component
 * Follows .cursorrules medical compliance standards
 */
export interface AnalysisCardProps {
  /** Section title (bilingual support) */
  title: string;
  /** Section content with rich formatting support */
  content: string | React.ReactNode;
  /** Icon to display with the section */
  icon?: React.ReactNode;
  /** Safety level indicator */
  safetyLevel?: 'safe' | 'caution' | 'warning';
  /** Whether the section is collapsible */
  collapsible?: boolean;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Section importance level */
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Medical-grade analysis card component with accessibility
 * Implements .cursorrules health information display standards
 * 
 * @example
 * ```tsx
 * <AnalysisCard
 *   title="基本介绍 (Basic Introduction)"
 *   content="Vitamin D3 is essential for bone health..."
 *   safetyLevel="safe"
 *   collapsible
 *   defaultExpanded
 * />
 * ```
 */
export function AnalysisCard({
  title,
  content,
  icon,
  safetyLevel,
  collapsible = true,
  defaultExpanded = false,
  className,
  priority = 'medium',
}: AnalysisCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const getSafetyIcon = () => {
    switch (safetyLevel) {
      case 'safe':
        return <CheckCircle className="h-5 w-5 text-health-success" aria-hidden="true" />;
      case 'caution':
        return <Info className="h-5 w-5 text-yellow-500" aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden="true" />;
      default:
        return null;
    }
  };

  const getSafetyColor = () => {
    switch (safetyLevel) {
      case 'safe':
        return 'border-health-200 bg-health-50';
      case 'caution':
        return 'border-yellow-200 bg-yellow-50';
      case 'warning':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const getPriorityIndicator = () => {
    switch (priority) {
      case 'high':
        return 'border-l-4 border-l-primary-500';
      case 'medium':
        return 'border-l-4 border-l-blue-300';
      case 'low':
        return 'border-l-4 border-l-gray-300';
      default:
        return '';
    }
  };

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  const cardId = `analysis-card-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div
      className={cn(
        'medical-card transition-all duration-200',
        getSafetyColor(),
        getPriorityIndicator(),
        className
      )}
    >
      {/* Card Header */}
      <div
        className={cn(
          'flex items-center justify-between p-4',
          collapsible && 'cursor-pointer hover:bg-gray-50'
        )}
        onClick={toggleExpanded}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? isExpanded : undefined}
        aria-controls={collapsible ? `${cardId}-content` : undefined}
        onKeyDown={(e) => {
          if (collapsible && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <div className="flex items-center space-x-3">
          {/* Custom icon or safety indicator */}
          {icon || getSafetyIcon()}
          
          <h3 className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
          
          {/* Priority indicator */}
          {priority === 'high' && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
              Essential
            </span>
          )}
        </div>

        {/* Collapse toggle */}
        {collapsible && (
          <div className="flex items-center">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {/* Card Content */}
      {(!collapsible || isExpanded) && (
        <div
          id={`${cardId}-content`}
          className="px-4 pb-4"
          role={collapsible ? 'region' : undefined}
          aria-labelledby={collapsible ? cardId : undefined}
        >
          <div className="prose prose-sm max-w-none text-gray-700">
            {typeof content === 'string' ? (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              content
            )}
          </div>
          
          {/* Safety disclaimer for medical content */}
          {safetyLevel && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
              <p className="text-xs text-gray-600">
                <strong>Medical Disclaimer:</strong> This information is for educational purposes only. 
                Consult a healthcare provider before making supplement decisions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 