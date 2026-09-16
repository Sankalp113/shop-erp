import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
          400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
          800: '#5b21b6', 900: '#4c1d95',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease both',
        'slide-up': 'slideUp 0.3s ease both',
      },
      boxShadow: {
        'glow': '0 0 30px rgba(124,58,237,0.3)',
        'glow-sm': '0 0 15px rgba(124,58,237,0.2)',
        'glass': '0 8px 32px rgba(0,0,0,0.3)',
      },
      backdropBlur: { xs: '2px' },
      borderRadius: { xl2: '1rem', xl3: '1.25rem' },
    },
  },
  plugins: [],
}

export default config
