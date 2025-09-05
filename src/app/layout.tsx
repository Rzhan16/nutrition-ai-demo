import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/layout/Navigation';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Nutrition AI Demo - AI-Powered Supplement Analysis',
  description: 'Professional AI-powered nutrition supplement analysis. Scan labels, get comprehensive nutritional insights, and make informed health decisions. Built for UBC community.',
  keywords: [
    'nutrition',
    'supplements',
    'AI analysis',
    'health',
    'UBC',
    'OCR',
    'nutrition facts',
    'supplement safety',
    'vitamin analysis',
  ],
  authors: [{ name: 'Nutrition AI Demo Team' }],
  creator: 'Nutrition AI Demo',
  publisher: 'Nutrition AI Demo',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://nutrition-ai-demo.vercel.app',
    title: 'Nutrition AI Demo - AI-Powered Supplement Analysis',
    description: 'Professional AI-powered nutrition supplement analysis with OCR scanning and comprehensive health insights.',
    siteName: 'Nutrition AI Demo',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Nutrition AI Demo - AI-Powered Supplement Analysis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nutrition AI Demo - AI-Powered Supplement Analysis',
    description: 'Professional AI-powered nutrition supplement analysis with OCR scanning.',
    images: ['/og-image.jpg'],
    creator: '@nutrition_ai_demo',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="application-name" content="Nutrition AI Demo" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Nutrition AI Demo" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        <ErrorBoundary>
          <div className="relative flex min-h-screen flex-col">
            <Navigation />
            <main className="flex-1">
              {children}
            </main>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}
