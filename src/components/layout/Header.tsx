'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Menu, Moon, Settings2, Sun } from 'lucide-react';
import { toggleDebugDrawer } from '@/components/analyze/DebugDrawer';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Navigation item interface for header menu
 */
interface NavigationItem {
  /** Display name of the navigation item */
  name: string;
  /** URL path for the navigation item */
  href: string;
  /** Optional icon component */
  icon?: React.ComponentType<{ className?: string }>;
  /** Whether this item is external */
  external?: boolean;
}

/**
 * Props interface for Header component
 */
export interface HeaderProps {
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the theme toggle */
  showThemeToggle?: boolean;
  /** Current theme mode */
  theme?: 'light' | 'dark' | 'system';
  /** Theme change callback */
  onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
  /** Whether navigation is sticky */
  sticky?: boolean;
}

/**
 * Navigation items configuration
 */
const navigation: NavigationItem[] = [
  { name: 'Home', href: '/' },
  { name: 'AI Scan', href: '/analyze' },
  { name: 'Components', href: '/components-demo' },
  { name: 'My Plan', href: '/plan' },
  { name: 'Community', href: '/community' },
];

/**
 * Professional header component with navigation and theme toggle
 * Implements accessibility standards and responsive design
 * 
 * @example
 * ```tsx
 * <Header 
 *   showThemeToggle
 *   theme="light"
 *   onThemeChange={(theme) => setTheme(theme)}
 *   sticky
 * />
 * ```
 */
export function Header({
  className,
  showThemeToggle = true,
  theme = 'light',
  onThemeChange,
  sticky = true,
}: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const isDebugPage = pathname === '/test-scanner';

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleThemeChange = useCallback((newTheme: 'light' | 'dark' | 'system') => {
    onThemeChange?.(newTheme);
  }, [onThemeChange]);

  const headerClasses = cn(
    'w-full border-b border-border-light bg-surface-white/95 backdrop-blur-sm',
    sticky && 'sticky top-0 z-50',
    className
  );

  return (
    <motion.header
      className={headerClasses}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container flex items-center justify-between py-4">
        {/* Logo */}
        <Link 
          href="/" 
          className="flex items-center space-x-2 group"
          aria-label="AI Nutrition Plan - Home"
        >
          <motion.div
            className="h-8 w-8 rounded-lg bg-gradient-vibrant flex items-center justify-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FlaskConical className="h-5 w-5 text-white" aria-hidden="true" />
          </motion.div>
          <span className="text-xl font-bold text-text-dark group-hover:text-vibrant-start transition-colors">
            AI Nutrition Plan
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6" role="navigation">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'relative px-3 py-2 text-sm font-medium transition-colors',
                  'hover:text-vibrant-start focus:outline-none focus:ring-2 focus:ring-vibrant-start focus:ring-offset-2',
                  isActive 
                    ? 'text-vibrant-start' 
                    : 'text-text-secondary hover:text-text-dark'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.name}
                {isActive && (
                  <motion.div
                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-vibrant-start"
                    layoutId="activeNavItem"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center space-x-4">
          {isDebugPage ? (
            <button
              type="button"
              onClick={() => toggleDebugDrawer()}
              className="relative z-[70] inline-flex items-center gap-2 rounded-full border border-border-light bg-white/90 px-3 py-2 text-sm font-medium text-text-dark shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-medical focus:ring-offset-2"
              aria-label="Toggle debug drawer"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Debug
            </button>
          ) : null}
          {/* Theme Toggle */}
          {showThemeToggle && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className="p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-vibrant-start focus:ring-offset-2 transition-colors"
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                </button>
              </DropdownMenu.Trigger>
              
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="bg-surface-white border border-border-light rounded-lg shadow-lg p-1 min-w-[120px]"
                  sideOffset={5}
                >
                  <DropdownMenu.Item
                    className="flex items-center px-3 py-2 text-sm rounded hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleThemeChange('light')}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center px-3 py-2 text-sm rounded hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleThemeChange('dark')}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center px-3 py-2 text-sm rounded hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleThemeChange('system')}
                  >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    System
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-vibrant-start focus:ring-offset-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle mobile menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="md:hidden border-t border-border-light bg-surface-white"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <nav className="container py-4 space-y-2" role="navigation">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'block px-3 py-2 rounded-lg text-base font-medium transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-vibrant-start focus:ring-offset-2',
                      isActive
                        ? 'bg-vibrant-start text-white'
                        : 'text-text-secondary hover:text-text-dark hover:bg-gray-100'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.name}
                  </Link>
                );
              })}
              
              {/* Mobile Theme Toggle */}
              {showThemeToggle && (
                <div className="pt-4 border-t border-border-light">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm font-medium text-text-secondary">Theme</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleThemeChange('light')}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          theme === 'light' ? 'bg-vibrant-start text-white' : 'hover:bg-gray-100'
                        )}
                        aria-label="Light theme"
                      >
                        <Sun className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleThemeChange('dark')}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          theme === 'dark' ? 'bg-vibrant-start text-white' : 'hover:bg-gray-100'
                        )}
                        aria-label="Dark theme"
                      >
                        <Moon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {isDebugPage ? (
                <div className="pt-4 border-t border-border-light">
                  <button
                    type="button"
                    onClick={() => toggleDebugDrawer()}
                    className="w-full rounded-lg bg-brand-medical px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-medical/90 focus:outline-none focus:ring-2 focus:ring-brand-medical focus:ring-offset-2"
                  >
                    Open Debug Drawer
                  </button>
                </div>
              ) : null}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
} 
