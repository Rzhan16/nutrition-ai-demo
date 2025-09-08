import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 🎨 TRUST & VITALITY FUSION COLOR SYSTEM
        
        // 🤍 Pure Foundation (Pure Encapsulations inspired)
        pure: {
          white: 'rgb(var(--pure-white))',
          light: 'rgb(var(--pure-light))',
          gray: 'rgb(var(--pure-gray))',
          border: 'rgb(var(--pure-border))',
        },
        
        // ⚡ Vitality Accents (Sports Research inspired)
        vitality: {
          primary: 'rgb(var(--vitality-primary))', // Energetic cyan
          green: 'rgb(var(--vitality-green))', // Fresh lime
          orange: 'rgb(var(--vitality-orange))', // Vibrant orange
        },
        
        // 📝 Scientific Typography
        text: {
          primary: 'rgb(var(--text-primary))', // Deep authority
          secondary: 'rgb(var(--text-secondary))', // Readable gray
          accent: 'rgb(var(--text-accent))', // Cyan highlights
        },
        
        // 🔬 Medical Grade Surfaces
        surface: {
          pure: 'rgb(var(--surface-pure))',
          elevated: 'rgb(var(--surface-elevated))',
          interactive: 'rgb(var(--surface-interactive))',
        },
        
        // 🎯 Functional Colors
        success: 'rgb(var(--success-fresh))',
        warning: 'rgb(var(--warning-energy))',
        error: 'rgb(var(--error-clinical))',
        info: 'rgb(var(--info-trust))',
        
        // Legacy colors for existing components
        health: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-success': 'pulseSuccess 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSuccess: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
};

export default config; 