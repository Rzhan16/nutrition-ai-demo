'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Info, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Scale,
  Target,
  Shield,
  Heart,
  Brain,
  Zap
} from 'lucide-react';
import * as Progress from '@radix-ui/react-progress';
import * as Separator from '@radix-ui/react-separator';
import { cn } from '@/lib/utils';

/**
 * Nutrient data interface
 */
export interface NutrientData {
  /** Nutrient identifier */
  id: string;
  /** Nutrient name */
  name: string;
  /** Common alternative names */
  aliases?: string[];
  /** Amount per serving */
  amount: number;
  /** Unit of measurement */
  unit: string;
  /** Recommended Daily Allowance */
  rda?: {
    /** RDA amount */
    amount: number;
    /** RDA unit */
    unit: string;
    /** Age group */
    ageGroup: string;
    /** Gender specification */
    gender?: 'male' | 'female' | 'both';
  };
  /** Upper Limit */
  upperLimit?: {
    /** UL amount */
    amount: number;
    /** UL unit */
    unit: string;
  };
  /** Daily Value percentage */
  dailyValuePercent?: number;
  /** Absorption rate percentage */
  absorptionRate?: number;
  /** Bioavailability score (1-10) */
  bioavailability?: number;
  /** Nutrient category */
  category: 'vitamin' | 'mineral' | 'amino-acid' | 'fatty-acid' | 'other';
  /** Safety level */
  safetyLevel: 'safe' | 'moderate' | 'caution' | 'warning';
  /** Health benefits */
  benefits: string[];
  /** Potential risks */
  risks?: string[];
  /** Food sources */
  foodSources: string[];
  /** Synergistic nutrients */
  synergies?: string[];
  /** Conflicting nutrients */
  conflicts?: string[];
}

/**
 * Props interface for NutrientInfo component
 */
export interface NutrientInfoProps {
  /** Nutrient data */
  nutrient: NutrientData;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show detailed view */
  detailed?: boolean;
  /** Whether to animate on mount */
  animate?: boolean;
  /** Callback for interaction events */
  onInteraction?: (action: string, nutrientId: string) => void;
}

/**
 * Get category icon based on nutrient category
 */
function getCategoryIcon(category: NutrientData['category']) {
  switch (category) {
    case 'vitamin':
      return Zap;
    case 'mineral':
      return Shield;
    case 'amino-acid':
      return Brain;
    case 'fatty-acid':
      return Heart;
    default:
      return Info;
  }
}

/**
 * Get category color based on nutrient category
 */
function getCategoryColor(category: NutrientData['category']) {
  switch (category) {
    case 'vitamin':
      return 'text-orange-600 bg-orange-100';
    case 'mineral':
      return 'text-blue-600 bg-blue-100';
    case 'amino-acid':
      return 'text-purple-600 bg-purple-100';
    case 'fatty-acid':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Get safety level color and icon
 */
function getSafetyDisplay(safetyLevel: NutrientData['safetyLevel']) {
  switch (safetyLevel) {
    case 'safe':
      return {
        color: 'text-green-600 bg-green-100',
        icon: CheckCircle,
        label: 'Safe',
      };
    case 'moderate':
      return {
        color: 'text-blue-600 bg-blue-100',
        icon: Info,
        label: 'Moderate',
      };
    case 'caution':
      return {
        color: 'text-amber-600 bg-amber-100',
        icon: AlertTriangle,
        label: 'Caution',
      };
    case 'warning':
      return {
        color: 'text-red-600 bg-red-100',
        icon: AlertTriangle,
        label: 'Warning',
      };
  }
}

/**
 * Professional nutrient information component with comprehensive data display
 * Implements medical compliance and accessibility standards
 * 
 * @example
 * ```tsx
 * <NutrientInfo 
 *   nutrient={vitaminD3Data}
 *   detailed
 *   animate
 *   onInteraction={(action, id) => console.log(action, id)}
 * />
 * ```
 */
export function NutrientInfo({
  nutrient,
  className,
  detailed = false,
  animate = true,
  onInteraction,
}: NutrientInfoProps) {
  const CategoryIcon = getCategoryIcon(nutrient.category);
  const categoryColor = getCategoryColor(nutrient.category);
  const safetyDisplay = getSafetyDisplay(nutrient.safetyLevel);
  const SafetyIcon = safetyDisplay.icon;

  const rdaProgress = nutrient.rda && nutrient.amount 
    ? Math.min((nutrient.amount / nutrient.rda.amount) * 100, 200)
    : 0;

  const ulProgress = nutrient.upperLimit && nutrient.amount
    ? Math.min((nutrient.amount / nutrient.upperLimit.amount) * 100, 100)
    : 0;

  const handleInteraction = (action: string) => {
    onInteraction?.(action, nutrient.id);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <motion.div
      className={cn('card p-6', className)}
      variants={animate ? containerVariants : undefined}
      initial={animate ? 'hidden' : undefined}
      animate={animate ? 'visible' : undefined}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <motion.div 
        className="flex items-start justify-between mb-6"
        variants={itemVariants}
      >
        <div className="flex items-start space-x-4">
          <div className={cn('p-3 rounded-xl', categoryColor)}>
            <CategoryIcon className="h-6 w-6" />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-text-dark mb-1">
              {nutrient.name}
            </h3>
            {nutrient.aliases && nutrient.aliases.length > 0 && (
              <p className="text-sm text-text-secondary">
                Also known as: {nutrient.aliases.join(', ')}
              </p>
            )}
            <div className="flex items-center space-x-2 mt-2">
              <span className={cn('px-2 py-1 rounded-full text-xs font-medium', categoryColor)}>
                {nutrient.category.replace('-', ' ')}
              </span>
              <div className={cn('flex items-center space-x-1 px-2 py-1 rounded-full text-xs', safetyDisplay.color)}>
                <SafetyIcon className="h-3 w-3" />
                <span>{safetyDisplay.label}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleInteraction('bookmark')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={`Bookmark ${nutrient.name}`}
        >
          <Heart className="h-5 w-5 text-text-secondary hover:text-red-500" />
        </button>
      </motion.div>

      {/* Amount and Daily Value */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"
        variants={itemVariants}
      >
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-text-dark mb-1">
            {nutrient.amount} <span className="text-base text-text-secondary">{nutrient.unit}</span>
          </div>
          <p className="text-sm text-text-secondary">Per Serving</p>
        </div>

        {nutrient.dailyValuePercent && (
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-vibrant-start mb-1">
              {nutrient.dailyValuePercent}%
            </div>
            <p className="text-sm text-text-secondary">Daily Value</p>
          </div>
        )}

        {nutrient.bioavailability && (
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">{nutrient.bioavailability}/10</span>
            </div>
            <p className="text-sm text-text-secondary">Bioavailability</p>
          </div>
        )}
      </motion.div>

      {/* RDA and Upper Limit Progress */}
      {(nutrient.rda || nutrient.upperLimit) && (
        <motion.div 
          className="space-y-4 mb-6"
          variants={itemVariants}
        >
          {nutrient.rda && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-text-dark">
                    RDA ({nutrient.rda.ageGroup})
                  </span>
                </div>
                <span className="text-sm text-text-secondary">
                  {nutrient.rda.amount} {nutrient.rda.unit}
                </span>
              </div>
              <Progress.Root className="relative overflow-hidden bg-gray-200 rounded-full w-full h-2">
                <Progress.Indicator
                  className={cn(
                    'h-full transition-transform duration-300 ease-out',
                    rdaProgress <= 100 ? 'bg-green-500' : 'bg-amber-500'
                  )}
                  style={{ transform: `translateX(-${100 - Math.min(rdaProgress, 100)}%)` }}
                />
              </Progress.Root>
              <p className="text-xs text-text-secondary mt-1">
                {rdaProgress.toFixed(0)}% of recommended daily allowance
              </p>
            </div>
          )}

          {nutrient.upperLimit && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-text-dark">Upper Limit</span>
                </div>
                <span className="text-sm text-text-secondary">
                  {nutrient.upperLimit.amount} {nutrient.upperLimit.unit}
                </span>
              </div>
              <Progress.Root className="relative overflow-hidden bg-gray-200 rounded-full w-full h-2">
                <Progress.Indicator
                  className={cn(
                    'h-full transition-transform duration-300 ease-out',
                    ulProgress <= 50 ? 'bg-green-500' : ulProgress <= 80 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ transform: `translateX(-${100 - ulProgress}%)` }}
                />
              </Progress.Root>
              <p className="text-xs text-text-secondary mt-1">
                {ulProgress.toFixed(0)}% of upper safety limit
              </p>
            </div>
          )}
        </motion.div>
      )}

      {detailed && (
        <>
          <Separator.Root className="my-6 h-px bg-border-light" />

          {/* Benefits */}
          <motion.div 
            className="mb-6"
            variants={itemVariants}
          >
            <h4 className="text-lg font-semibold text-text-dark mb-3 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              Health Benefits
            </h4>
            <ul className="space-y-2">
              {nutrient.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start space-x-2 text-text-secondary">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-sm">{benefit}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Food Sources */}
          <motion.div 
            className="mb-6"
            variants={itemVariants}
          >
            <h4 className="text-lg font-semibold text-text-dark mb-3 flex items-center">
              <Scale className="h-5 w-5 text-blue-600 mr-2" />
              Natural Food Sources
            </h4>
            <div className="flex flex-wrap gap-2">
              {nutrient.foodSources.map((source, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {source}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Interactions */}
          {(nutrient.synergies || nutrient.conflicts) && (
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              variants={itemVariants}
            >
              {nutrient.synergies && (
                <div>
                  <h4 className="text-lg font-semibold text-text-dark mb-3 flex items-center">
                    <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                    Works Well With
                  </h4>
                  <div className="space-y-2">
                    {nutrient.synergies.map((synergy, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-text-secondary">{synergy}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nutrient.conflicts && (
                <div>
                  <h4 className="text-lg font-semibold text-text-dark mb-3 flex items-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
                    May Interfere With
                  </h4>
                  <div className="space-y-2">
                    {nutrient.conflicts.map((conflict, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-text-secondary">{conflict}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Risks */}
          {nutrient.risks && nutrient.risks.length > 0 && (
            <motion.div 
              className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
              variants={itemVariants}
            >
              <h4 className="text-lg font-semibold text-red-800 mb-3 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Potential Risks & Precautions
              </h4>
              <ul className="space-y-2">
                {nutrient.risks.map((risk, index) => (
                  <li key={index} className="flex items-start space-x-2 text-red-700">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{risk}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </>
      )}

      {/* Action Buttons */}
      <motion.div 
        className="flex items-center justify-between mt-6 pt-4 border-t border-border-light"
        variants={itemVariants}
      >
        <button
          onClick={() => handleInteraction('view-details')}
          className="text-sm text-vibrant-start hover:text-vibrant-end font-medium transition-colors"
        >
          {detailed ? 'Hide Details' : 'View Details'}
        </button>
        
        <div className="flex space-x-2">
          <button
            onClick={() => handleInteraction('add-to-plan')}
            className="px-4 py-2 bg-vibrant-start text-white rounded-lg hover:bg-vibrant-end transition-colors text-sm font-medium"
          >
            Add to Plan
          </button>
          <button
            onClick={() => handleInteraction('share')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={`Share ${nutrient.name} information`}
          >
            <TrendingUp className="h-4 w-4 text-text-secondary" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
} 