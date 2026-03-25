/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        up: '#10b981',       // emerald-500
        down: '#ef4444',     // red-500
        hold: '#f59e0b',     // amber-500
        primary: {
          DEFAULT: '#6366f1',
          foreground: '#ffffff',
        },
        card: '#ffffff',
        border: '#e2e8f0',
        muted: {
          DEFAULT: '#f8fafc',
          foreground: '#64748b',
        },
        accent: '#f1f5f9',
        success: '#10b981',
        destructive: '#ef4444',
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
