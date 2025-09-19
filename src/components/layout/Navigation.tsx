'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'AI Scan', href: '/analyze' },
  { name: 'Search', href: '/search' },
  { name: 'Upload', href: '/upload' },
  { name: 'Test Scanner', href: '/test-scanner' },
  { name: 'My Plan', href: '/plan' },
  { name: 'Community', href: '/community' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="py-4 border-b border-border-light bg-surface-white">
      <div className="container flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-text-dark">AI Nutrition Plan</h1>
        <nav className="hidden md:flex space-x-6">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'text-text-secondary hover:text-text-dark transition-colors',
                pathname === item.href && 'text-text-dark font-medium'
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <button className="md:hidden text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
      </div>
    </header>
  );
} 