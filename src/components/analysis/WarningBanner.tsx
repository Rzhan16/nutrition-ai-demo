'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ExternalLink,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Warning severity levels
 */
export type WarningSeverity = 'info' | 'warning' | 'danger' | 'critical';

/**
 * Warning category types
 */
export type WarningCategory = 
  | 'interaction'
  | 'dosage'
  | 'allergy'
  | 'medical-condition'
  | 'pregnancy'
  | 'medication'
  | 'general';

/**
 * Warning data interface
 */
export interface WarningData {
  /** Warning identifier */
  id: string;
  /** Warning title */
  title: string;
  /** Warning message */
  message: string;
  /** Severity level */
  severity: WarningSeverity;
  /** Warning category */
  category: WarningCategory;
  /** Whether this warning is dismissible */
  dismissible?: boolean;
  /** Action buttons */
  actions?: {
    /** Action label */
    label: string;
    /** Action type */
    type: 'primary' | 'secondary' | 'danger';
    /** Click handler */
    onClick: () => void;
  }[];
  /** External links for more information */
  links?: {
    /** Link label */
    label: string;
    /** Link URL */
    url: string;
    /** Whether link opens in new tab */
    external?: boolean;
  }[];
  /** Emergency contact information */
  emergency?: {
    /** Emergency message */
    message: string;
    /** Phone number */
    phone: string;
  };
}

/**
 * Props interface for WarningBanner component
 */
export interface WarningBannerProps {
  /** Warning data */
  warning: WarningData;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show animation */
  animate?: boolean;
  /** Dismiss callback */
  onDismiss?: (warningId: string) => void;
}

/**
 * Get severity configuration
 */
function getSeverityConfig(severity: WarningSeverity) {
  switch (severity) {
    case 'info':
      return {
        icon: Info,
        colors: 'bg-blue-50 border-blue-200 text-blue-800',
        iconColor: 'text-blue-600',
        titleColor: 'text-blue-900',
      };
    case 'warning':
      return {
        icon: AlertTriangle,
        colors: 'bg-amber-50 border-amber-200 text-amber-800',
        iconColor: 'text-amber-600',
        titleColor: 'text-amber-900',
      };
    case 'danger':
      return {
        icon: AlertCircle,
        colors: 'bg-red-50 border-red-200 text-red-800',
        iconColor: 'text-red-600',
        titleColor: 'text-red-900',
      };
    case 'critical':
      return {
        icon: AlertTriangle,
        colors: 'bg-red-100 border-red-300 text-red-900',
        iconColor: 'text-red-700',
        titleColor: 'text-red-900',
      };
  }
}

/**
 * Get category display information
 */
function getCategoryInfo(category: WarningCategory) {
  switch (category) {
    case 'interaction':
      return {
        label: 'Drug Interaction',
        description: 'This supplement may interact with medications or other supplements',
      };
    case 'dosage':
      return {
        label: 'Dosage Warning',
        description: 'Important information about dosage limits and safety',
      };
    case 'allergy':
      return {
        label: 'Allergy Alert',
        description: 'Contains ingredients that may cause allergic reactions',
      };
    case 'medical-condition':
      return {
        label: 'Medical Condition',
        description: 'Important for people with specific medical conditions',
      };
    case 'pregnancy':
      return {
        label: 'Pregnancy & Breastfeeding',
        description: 'Special considerations for pregnant or breastfeeding women',
      };
    case 'medication':
      return {
        label: 'Medication Alert',
        description: 'May affect or be affected by prescription medications',
      };
    case 'general':
      return {
        label: 'General Warning',
        description: 'Important safety information',
      };
  }
}

/**
 * Professional warning banner component for safety alerts
 * Implements medical compliance and accessibility standards
 * 
 * @example
 * ```tsx
 * <WarningBanner 
 *   warning={{
 *     id: '1',
 *     title: 'Drug Interaction Warning',
 *     message: 'This supplement may interact with blood thinners.',
 *     severity: 'danger',
 *     category: 'interaction',
 *     dismissible: false
 *   }}
 *   animate
 *   onDismiss={(id) => console.log('Dismissed:', id)}
 * />
 * ```
 */
export function WarningBanner({
  warning,
  className,
  animate = true,
  onDismiss,
}: WarningBannerProps) {
  const severityConfig = getSeverityConfig(warning.severity);
  const categoryInfo = getCategoryInfo(warning.category);
  const SeverityIcon = severityConfig.icon;

  const handleDismiss = () => {
    if (warning.dismissible && onDismiss) {
      onDismiss(warning.id);
    }
  };

  const bannerVariants = {
    hidden: { 
      opacity: 0, 
      y: -20,
      scale: 0.95 
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 25,
        staggerChildren: 0.1
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.95,
      transition: { duration: 0.2 }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <motion.div
      className={cn(
        'border rounded-lg p-4',
        severityConfig.colors,
        warning.severity === 'critical' && 'ring-2 ring-red-300 shadow-lg',
        className
      )}
      variants={animate ? bannerVariants : undefined}
      initial={animate ? 'hidden' : undefined}
      animate={animate ? 'visible' : undefined}
      exit={animate ? 'exit' : undefined}
      role="alert"
      aria-live={warning.severity === 'critical' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start space-x-3">
        {/* Warning Icon */}
        <motion.div
          className="flex-shrink-0"
          variants={contentVariants}
        >
          <SeverityIcon 
            className={cn('h-6 w-6', severityConfig.iconColor)}
            aria-hidden="true"
          />
        </motion.div>

        {/* Content */}
        <motion.div 
          className="flex-1 min-w-0"
          variants={contentVariants}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className={cn('text-lg font-semibold', severityConfig.titleColor)}>
                {warning.title}
              </h3>
              <p className="text-xs font-medium opacity-75 mt-1">
                {categoryInfo.label}
              </p>
            </div>

            {/* Dismiss Button */}
            {warning.dismissible && onDismiss && (
              <button
                onClick={handleDismiss}
                className="ml-3 p-1 hover:bg-black/10 rounded transition-colors"
                aria-label="Dismiss warning"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Message */}
          <p className="text-sm leading-relaxed mb-4">
            {warning.message}
          </p>

          {/* Emergency Contact */}
          {warning.emergency && (
            <motion.div 
              className="mb-4 p-3 bg-black/10 rounded-lg"
              variants={contentVariants}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Phone className="h-4 w-4" />
                <span className="text-sm font-semibold">Emergency Contact</span>
              </div>
              <p className="text-sm mb-2">{warning.emergency.message}</p>
              <a 
                href={`tel:${warning.emergency.phone}`}
                className="text-sm font-mono font-bold underline hover:no-underline"
              >
                {warning.emergency.phone}
              </a>
            </motion.div>
          )}

          {/* Links */}
          {warning.links && warning.links.length > 0 && (
            <motion.div 
              className="mb-4"
              variants={contentVariants}
            >
              <h4 className="text-sm font-semibold mb-2 flex items-center">
                <Info className="h-4 w-4 mr-1" />
                More Information
              </h4>
              <ul className="space-y-1">
                {warning.links.map((link, index) => (
                  <li key={index}>
                    <a
                      href={link.url}
                      className="text-sm underline hover:no-underline flex items-center"
                      {...(link.external && {
                        target: '_blank',
                        rel: 'noopener noreferrer'
                      })}
                    >
                      {link.label}
                      {link.external && (
                        <ExternalLink className="h-3 w-3 ml-1" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Action Buttons */}
          {warning.actions && warning.actions.length > 0 && (
            <motion.div 
              className="flex flex-wrap gap-2"
              variants={contentVariants}
            >
              {warning.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={cn(
                    'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    action.type === 'primary' && 'bg-white/20 hover:bg-white/30 backdrop-blur-sm',
                    action.type === 'secondary' && 'bg-black/10 hover:bg-black/20',
                    action.type === 'danger' && 'bg-red-600 text-white hover:bg-red-700'
                  )}
                >
                  {action.label}
                </button>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Critical Warning Pulse Animation */}
      {warning.severity === 'critical' && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-red-400"
          animate={{
            opacity: [0.5, 0.8, 0.5],
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </motion.div>
  );
}

/**
 * Multiple warnings container component
 */
export interface WarningBannerGroupProps {
  /** Array of warnings to display */
  warnings: WarningData[];
  /** Additional CSS classes */
  className?: string;
  /** Whether to show animations */
  animate?: boolean;
  /** Dismiss callback */
  onDismiss?: (warningId: string) => void;
  /** Maximum number of warnings to show */
  maxVisible?: number;
}

/**
 * Container for multiple warning banners with priority sorting
 */
export function WarningBannerGroup({
  warnings,
  className,
  animate = true,
  onDismiss,
  maxVisible = 5,
}: WarningBannerGroupProps) {
  // Sort warnings by severity (critical first)
  const sortedWarnings = [...warnings].sort((a, b) => {
    const severityOrder = { critical: 0, danger: 1, warning: 2, info: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const visibleWarnings = sortedWarnings.slice(0, maxVisible);
  const hiddenCount = warnings.length - maxVisible;

  return (
    <div className={cn('space-y-4', className)}>
      {visibleWarnings.map((warning) => (
        <WarningBanner
          key={warning.id}
          warning={warning}
          animate={animate}
          onDismiss={onDismiss}
        />
      ))}
      
      {hiddenCount > 0 && (
        <div className="text-center py-2">
          <p className="text-sm text-text-secondary">
            + {hiddenCount} more warning{hiddenCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
} 
