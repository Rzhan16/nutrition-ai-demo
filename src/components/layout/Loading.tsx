'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props interface for Skeleton component
 */
interface SkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to animate the skeleton */
  animate?: boolean;
}

/**
 * Basic skeleton component for loading states
 */
export function Skeleton({ className, animate = true }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-gray-200 rounded',
        animate && 'animate-pulse',
        className
      )}
    />
  );
}

/**
 * Props interface for Loading components
 */
interface LoadingProps {
  /** Additional CSS classes */
  className?: string;
  /** Loading message */
  message?: string;
  /** Whether to show spinner */
  showSpinner?: boolean;
}

/**
 * Basic spinner loading component
 */
export function Spinner({ className, message, showSpinner = true }: LoadingProps) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="text-center">
        {showSpinner && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="mx-auto mb-4"
          >
            <Loader2 className="h-8 w-8 text-vibrant-start" />
          </motion.div>
        )}
        {message && (
          <p className="text-sm text-text-secondary">{message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Card skeleton for loading card components
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('card p-6', className)}>
      <div className="flex items-center space-x-3 mb-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="mt-6 flex space-x-3">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Analysis result skeleton
 */
export function AnalysisResultSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Skeleton className="h-16 w-16 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      {/* Analysis sections */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Search results skeleton
 */
export function SearchResultsSkeleton({ className, count = 5 }: { className?: string; count?: number }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-6">
          <div className="flex items-start space-x-4">
            <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
              <div className="flex space-x-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Navigation skeleton
 */
export function NavigationSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('border-b border-border-light bg-surface-white', className)}>
      <div className="container py-4">
        <div className="flex items-center justify-between">
          {/* Logo skeleton */}
          <div className="flex items-center space-x-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-32" />
          </div>

          {/* Navigation links skeleton */}
          <div className="hidden md:flex items-center space-x-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>

          {/* Actions skeleton */}
          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Sidebar skeleton
 */
export function SidebarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('w-80 border-r border-border-light bg-surface-white', className)}>
      <div className="p-6 border-b border-border-light">
        <Skeleton className="h-6 w-24" />
      </div>
      
      <div className="p-4 space-y-4">
        {/* Categories */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center space-x-3 p-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-4" />
            </div>
            
            {/* Subcategories */}
            {i < 2 && (
              <div className="ml-8 space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between p-2">
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-3 w-3" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3 w-6" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Recent searches */}
        <div className="pt-4 border-t border-border-light">
          <div className="flex items-center space-x-2 mb-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-28" />
          </div>
          
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-3 space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-3 w-16 rounded-full" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Page skeleton for full page loading
 */
export function PageSkeleton({ 
  showNavigation = true, 
  showSidebar = false,
  className 
}: { 
  showNavigation?: boolean; 
  showSidebar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('min-h-screen bg-bg-main', className)}>
      {showNavigation && <NavigationSkeleton />}
      
      <div className="flex">
        {showSidebar && <SidebarSkeleton />}
        
        <main className="flex-1 p-6">
          {/* Hero section */}
          <div className="container py-16 text-center">
            <Skeleton className="h-12 w-96 mx-auto mb-4" />
            <Skeleton className="h-6 w-2/3 mx-auto mb-8" />
            <div className="flex justify-center space-x-4">
              <Skeleton className="h-12 w-32 rounded-full" />
              <Skeleton className="h-12 w-28 rounded-full" />
            </div>
          </div>

          {/* Content sections */}
          <div className="container space-y-16">
            <CardSkeleton />
            <SearchResultsSkeleton count={3} />
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Upload skeleton
 */
export function UploadSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('border-2 border-dashed border-border-light rounded-lg p-8 text-center bg-surface-white', className)}>
      <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
      <Skeleton className="h-6 w-48 mx-auto mb-2" />
      <Skeleton className="h-4 w-64 mx-auto mb-4" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-32 mx-auto" />
        <Skeleton className="h-3 w-28 mx-auto" />
      </div>
    </div>
  );
}

/**
 * Search box skeleton
 */
export function SearchBoxSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="absolute right-3 top-3 h-6 w-6 rounded" />
      </div>
    </div>
  );
} 