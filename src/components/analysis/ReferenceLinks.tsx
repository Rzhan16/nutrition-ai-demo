'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ExternalLink, 
  BookOpen, 
  Shield, 
  Award,
  Clock,
  Globe,
  FileText,
  Microscope,
  Building
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Reference source types
 */
export type ReferenceType = 
  | 'journal'
  | 'government'
  | 'medical-org'
  | 'database'
  | 'clinical-study'
  | 'guideline'
  | 'book'
  | 'website';

/**
 * Reference data interface
 */
export interface ReferenceData {
  /** Reference identifier */
  id: string;
  /** Reference title */
  title: string;
  /** Source/publication name */
  source: string;
  /** Authors */
  authors?: string[];
  /** Publication date */
  date?: string;
  /** DOI or identifier */
  doi?: string;
  /** URL */
  url: string;
  /** Reference type */
  type: ReferenceType;
  /** Credibility score (1-10) */
  credibilityScore?: number;
  /** Brief description */
  description?: string;
  /** Study type (for clinical studies) */
  studyType?: 'randomized-trial' | 'meta-analysis' | 'observational' | 'review';
  /** Sample size (for studies) */
  sampleSize?: number;
  /** Access level */
  accessLevel: 'free' | 'subscription' | 'paywall';
}

/**
 * Props interface for ReferenceLinks component
 */
export interface ReferenceLinksProps {
  /** Array of references */
  references: ReferenceData[];
  /** Additional CSS classes */
  className?: string;
  /** Whether to show detailed view */
  detailed?: boolean;
  /** Whether to animate on mount */
  animate?: boolean;
  /** Maximum number of references to show */
  maxVisible?: number;
  /** Sort order */
  sortBy?: 'date' | 'credibility' | 'type' | 'default';
}

/**
 * Get reference type configuration
 */
function getTypeConfig(type: ReferenceType) {
  switch (type) {
    case 'journal':
      return {
        icon: BookOpen,
        label: 'Journal Article',
        color: 'text-blue-600 bg-blue-100',
        priority: 1,
      };
    case 'government':
      return {
        icon: Shield,
        label: 'Government Source',
        color: 'text-green-600 bg-green-100',
        priority: 2,
      };
    case 'medical-org':
      return {
        icon: Award,
        label: 'Medical Organization',
        color: 'text-purple-600 bg-purple-100',
        priority: 3,
      };
    case 'clinical-study':
      return {
        icon: Microscope,
        label: 'Clinical Study',
        color: 'text-red-600 bg-red-100',
        priority: 1,
      };
    case 'database':
      return {
        icon: Building,
        label: 'Database',
        color: 'text-orange-600 bg-orange-100',
        priority: 4,
      };
    case 'guideline':
      return {
        icon: FileText,
        label: 'Clinical Guideline',
        color: 'text-indigo-600 bg-indigo-100',
        priority: 2,
      };
    case 'book':
      return {
        icon: BookOpen,
        label: 'Book/Textbook',
        color: 'text-gray-600 bg-gray-100',
        priority: 5,
      };
    case 'website':
      return {
        icon: Globe,
        label: 'Website',
        color: 'text-teal-600 bg-teal-100',
        priority: 6,
      };
  }
}

/**
 * Get credibility badge
 */
function getCredibilityBadge(score?: number) {
  if (!score) return null;
  
  if (score >= 9) {
    return { label: 'Excellent', color: 'bg-green-500 text-white' };
  } else if (score >= 7) {
    return { label: 'Good', color: 'bg-blue-500 text-white' };
  } else if (score >= 5) {
    return { label: 'Fair', color: 'bg-amber-500 text-white' };
  } else {
    return { label: 'Low', color: 'bg-gray-500 text-white' };
  }
}

/**
 * Get access level badge
 */
function getAccessBadge(accessLevel: ReferenceData['accessLevel']) {
  switch (accessLevel) {
    case 'free':
      return { label: 'Free', color: 'bg-green-100 text-green-800' };
    case 'subscription':
      return { label: 'Subscription', color: 'bg-blue-100 text-blue-800' };
    case 'paywall':
      return { label: 'Paid', color: 'bg-amber-100 text-amber-800' };
  }
}

/**
 * Format date string
 */
function formatDate(dateString?: string) {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    });
  } catch {
    return dateString;
  }
}

/**
 * Professional reference links component for citations
 * Implements academic standards and accessibility
 * 
 * @example
 * ```tsx
 * <ReferenceLinks 
 *   references={[
 *     {
 *       id: '1',
 *       title: 'Vitamin D and Health',
 *       source: 'New England Journal of Medicine',
 *       url: 'https://nejm.org/...',
 *       type: 'journal',
 *       credibilityScore: 9,
 *       accessLevel: 'subscription'
 *     }
 *   ]}
 *   detailed
 *   animate
 *   sortBy="credibility"
 * />
 * ```
 */
export function ReferenceLinks({
  references,
  className,
  detailed = false,
  animate = true,
  maxVisible = 10,
  sortBy = 'default',
}: ReferenceLinksProps) {
  // Sort references
  const sortedReferences = React.useMemo(() => {
    const sorted = [...references];
    
    switch (sortBy) {
      case 'date':
        return sorted.sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
      case 'credibility':
        return sorted.sort((a, b) => (b.credibilityScore || 0) - (a.credibilityScore || 0));
      case 'type':
        return sorted.sort((a, b) => {
          const aConfig = getTypeConfig(a.type);
          const bConfig = getTypeConfig(b.type);
          return aConfig.priority - bConfig.priority;
        });
      default:
        return sorted;
    }
  }, [references, sortBy]);

  const visibleReferences = sortedReferences.slice(0, maxVisible);
  const hiddenCount = references.length - maxVisible;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (references.length === 0) {
    return (
      <div className={cn('text-center py-8 text-text-secondary', className)}>
        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No references available</p>
      </div>
    );
  }

  return (
    <motion.div
      className={cn('space-y-4', className)}
      variants={animate ? containerVariants : undefined}
      initial={animate ? 'hidden' : undefined}
      animate={animate ? 'visible' : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-text-secondary" />
          <h3 className="text-lg font-semibold text-text-dark">
            References & Sources
          </h3>
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
            {references.length}
          </span>
        </div>
        
        {references.length > 1 && (
          <div className="text-xs text-text-secondary">
            Sorted by {sortBy === 'default' ? 'relevance' : sortBy}
          </div>
        )}
      </div>

      {/* References List */}
      <div className="space-y-3">
        {visibleReferences.map((reference) => {
          const typeConfig = getTypeConfig(reference.type);
          const TypeIcon = typeConfig.icon;
          const credibilityBadge = getCredibilityBadge(reference.credibilityScore);
          const accessBadge = getAccessBadge(reference.accessLevel);

          return (
            <motion.div
              key={reference.id}
              className="card p-4 hover:shadow-md transition-shadow"
              variants={itemVariants}
              whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
            >
              <div className="flex items-start space-x-3">
                {/* Type Icon */}
                <div className={cn('p-2 rounded-lg flex-shrink-0', typeConfig.color)}>
                  <TypeIcon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text-dark leading-tight mb-1">
                        <a
                          href={reference.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-vibrant-start transition-colors"
                        >
                          {reference.title}
                        </a>
                      </h4>
                      
                      <p className="text-sm text-text-secondary font-medium">
                        {reference.source}
                      </p>
                    </div>

                    {/* External Link */}
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                      aria-label={`Open ${reference.title} in new tab`}
                    >
                      <ExternalLink className="h-4 w-4 text-text-secondary" />
                    </a>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {/* Type Badge */}
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', typeConfig.color)}>
                      {typeConfig.label}
                    </span>

                    {/* Credibility Badge */}
                    {credibilityBadge && (
                      <span className={cn('px-2 py-1 rounded-full text-xs font-medium', credibilityBadge.color)}>
                        {credibilityBadge.label}
                      </span>
                    )}

                    {/* Access Badge */}
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', accessBadge.color)}>
                      {accessBadge.label}
                    </span>

                    {/* Date */}
                    {reference.date && (
                      <div className="flex items-center space-x-1 text-xs text-text-secondary">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(reference.date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {detailed && reference.description && (
                    <p className="text-sm text-text-secondary leading-relaxed mb-2">
                      {reference.description}
                    </p>
                  )}

                  {/* Additional Details */}
                  {detailed && (
                    <div className="text-xs text-text-secondary space-y-1">
                      {/* Authors */}
                      {reference.authors && reference.authors.length > 0 && (
                        <p>
                          <span className="font-medium">Authors:</span> {reference.authors.join(', ')}
                        </p>
                      )}

                      {/* DOI */}
                      {reference.doi && (
                        <p>
                          <span className="font-medium">DOI:</span> {reference.doi}
                        </p>
                      )}

                      {/* Study Details */}
                      {reference.type === 'clinical-study' && (
                        <div className="flex flex-wrap gap-4">
                          {reference.studyType && (
                            <span>
                              <span className="font-medium">Study Type:</span> {reference.studyType.replace('-', ' ')}
                            </span>
                          )}
                          {reference.sampleSize && (
                            <span>
                              <span className="font-medium">Sample Size:</span> {reference.sampleSize.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Show More */}
      {hiddenCount > 0 && (
        <motion.div 
          className="text-center py-4"
          variants={itemVariants}
        >
          <p className="text-sm text-text-secondary">
            + {hiddenCount} more reference{hiddenCount !== 1 ? 's' : ''}
          </p>
        </motion.div>
      )}

      {/* Footer Note */}
      <motion.div 
        className="mt-6 p-4 bg-gray-50 rounded-lg"
        variants={itemVariants}
      >
        <p className="text-xs text-text-secondary leading-relaxed">
          <strong>Note:</strong> These references are provided for educational purposes. 
          Always verify information with current medical literature and consult healthcare 
          professionals for medical advice. Access to some sources may require subscriptions 
          or institutional access.
        </p>
      </motion.div>
    </motion.div>
  );
}

/**
 * Quick reference component for inline citations
 */
export interface QuickReferenceProps {
  /** Reference data */
  reference: ReferenceData;
  /** Display format */
  format?: 'full' | 'author-year' | 'number';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Inline reference citation component
 */
export function QuickReference({ 
  reference, 
  format = 'author-year',
  className 
}: QuickReferenceProps) {
  const formatCitation = () => {
    switch (format) {
      case 'full':
        return `${reference.authors?.[0] || reference.source} (${formatDate(reference.date) || 'n.d.'}). ${reference.title}`;
      case 'number':
        return `[${reference.id}]`;
      case 'author-year':
      default:
        return `(${reference.authors?.[0]?.split(' ').pop() || reference.source}, ${formatDate(reference.date) || 'n.d.'})`;
    }
  };

  return (
    <a
      href={reference.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center space-x-1 text-sm text-vibrant-start hover:text-vibrant-end transition-colors',
        className
      )}
      title={reference.title}
    >
      <span>{formatCitation()}</span>
      <ExternalLink className="h-3 w-3" />
    </a>
  );
} 
