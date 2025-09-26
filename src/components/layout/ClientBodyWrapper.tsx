'use client';

import { useEffect } from 'react';

interface ClientBodyWrapperProps {
  children: React.ReactNode;
  className: string;
}

export function ClientBodyWrapper({ children, className }: ClientBodyWrapperProps) {
  useEffect(() => {
    // Handle browser extension attributes that cause hydration mismatches
    if (typeof document !== 'undefined') {
      const body = document.body;
      
      // List of known browser extension attributes that cause hydration issues
      const extensionAttributes = [
        'data-new-gr-c-s-check-loaded',
        'data-gr-ext-installed',
        'data-gramm',
        'data-gramm_editor',
        'spellcheck',
        'data-adblockkey',
        'data-lastpass-icon-root'
      ];
      
      // Remove all extension attributes
      extensionAttributes.forEach(attr => {
        if (body.hasAttribute(attr)) {
          body.removeAttribute(attr);
        }
      });
      
      // Ensure our classes are applied correctly
      if (body.className !== className) {
        body.className = className;
      }
    }
  }, [className]);

  return <>{children}</>;
} 