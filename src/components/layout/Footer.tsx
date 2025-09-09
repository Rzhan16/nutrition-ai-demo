'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FlaskConical, Heart, Shield, ExternalLink } from 'lucide-react';
import * as Separator from '@radix-ui/react-separator';
import { cn } from '@/lib/utils';

/**
 * Footer link interface
 */
interface FooterLink {
  /** Display name of the link */
  name: string;
  /** URL path or external URL */
  href: string;
  /** Whether this is an external link */
  external?: boolean;
}

/**
 * Footer section interface
 */
interface FooterSection {
  /** Section title */
  title: string;
  /** Array of links in this section */
  links: FooterLink[];
}

/**
 * Props interface for Footer component
 */
export interface FooterProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the medical disclaimer */
  showDisclaimer?: boolean;
  /** Whether to show social links */
  showSocial?: boolean;
  /** Custom disclaimer text */
  disclaimerText?: string;
}

/**
 * Footer sections configuration
 */
const footerSections: FooterSection[] = [
  {
    title: 'Platform',
    links: [
      { name: 'Home', href: '/' },
      { name: 'AI Scan', href: '/analyze' },
      { name: 'My Plan', href: '/plan' },
      { name: 'Community', href: '/community' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'How it Works', href: '/how-it-works' },
      { name: 'FAQ', href: '/faq' },
      { name: 'Documentation', href: '/docs' },
      { name: 'API Reference', href: '/api', external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Medical Disclaimer', href: '/disclaimer' },
      { name: 'Cookie Policy', href: '/cookies' },
    ],
  },
  {
    title: 'Authority Sources',
    links: [
      { name: 'NIH ODS', href: 'https://ods.od.nih.gov/', external: true },
      { name: 'Health Canada', href: 'https://www.canada.ca/en/health-canada.html', external: true },
      { name: 'FDA', href: 'https://www.fda.gov/', external: true },
      { name: 'WHO', href: 'https://www.who.int/', external: true },
    ],
  },
];

/**
 * Professional footer component with comprehensive links and disclaimers
 * Implements medical compliance and accessibility standards
 * 
 * @example
 * ```tsx
 * <Footer 
 *   showDisclaimer
 *   showSocial
 *   disclaimerText="Custom medical disclaimer text"
 * />
 * ```
 */
export function Footer({
  className,
  showDisclaimer = true,
  showSocial = false,
  disclaimerText,
}: FooterProps) {
  const currentYear = new Date().getFullYear();

  const defaultDisclaimer = 
    "This analysis is for educational purposes only and does not constitute medical advice. " +
    "Always consult with a healthcare provider before starting any supplement regimen, especially " +
    "if you have medical conditions or take medications. The information provided is based on " +
    "scientific research and authoritative sources but should not replace professional medical consultation.";

  return (
    <footer className={cn('bg-surface-white border-t border-border-light', className)}>
      {/* Medical Disclaimer Banner */}
      {showDisclaimer && (
        <motion.div
          className="bg-gray-50 border-b border-border-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="container py-6">
            <div className="flex items-start space-x-3">
              <Shield className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-text-dark mb-2 flex items-center">
                  <span>Medical Disclaimer</span>
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">
                    Important
                  </span>
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {disclaimerText || defaultDisclaimer}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Footer Content */}
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-vibrant flex items-center justify-center">
                <FlaskConical className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <span className="text-lg font-bold text-text-dark">AI Nutrition</span>
            </div>
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              Professional AI-powered nutrition analysis platform. Making supplement decisions 
              easier with scientific data and expert insights.
            </p>
            <div className="flex items-center text-xs text-text-secondary">
              <span>Made with</span>
              <Heart className="h-3 w-3 mx-1 text-red-500" aria-hidden="true" />
              <span>for better health</span>
            </div>
          </div>

          {/* Footer Sections */}
          {footerSections.map((section) => (
            <div key={section.title} className="lg:col-span-1">
              <h3 className="text-sm font-semibold text-text-dark mb-4">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className={cn(
                        'text-sm text-text-secondary hover:text-vibrant-start transition-colors',
                        'focus:outline-none focus:underline',
                        link.external && 'inline-flex items-center'
                      )}
                      {...(link.external && {
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        'aria-label': `${link.name} (opens in new tab)`
                      })}
                    >
                      {link.name}
                      {link.external && (
                        <ExternalLink className="h-3 w-3 ml-1" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator.Root className="my-8 h-px bg-border-light" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          {/* Copyright */}
          <div className="text-sm text-text-secondary">
            <p>
              &copy; {currentYear} AI Nutrition Plan. All rights reserved.
            </p>
            <p className="mt-1">
              Built with Next.js, TypeScript, and Tailwind CSS.
            </p>
          </div>

          {/* Compliance Badges */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-text-secondary">
              <Shield className="h-4 w-4" aria-hidden="true" />
              <span>GDPR Compliant</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-text-secondary">
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              <span>Evidence-Based</span>
            </div>
          </div>
        </div>

        {/* Version Info */}
        <div className="mt-8 pt-4 border-t border-border-light">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-text-secondary">
            <div>
              <span>Version 1.0.0</span>
              <span className="mx-2">•</span>
              <span>Last updated: {new Date().toLocaleDateString()}</span>
            </div>
            <div className="mt-2 sm:mt-0">
              <span>Status: </span>
              <span className="inline-flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
} 