/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        stake: {
          bg: '#0a0a1a',
          card: '#12122a',
          hover: '#1a1a3a',
          border: '#2a2050',
          gray: '#8b85a8',
          gray2: '#5a5480',
        },
        neon: '#a855f7',
        danger: '#ef4444',
        gold: '#fbbf24',
        arcane: {
          purple: '#7c3aed',
          blue: '#3b82f6',
          pink: '#ec4899',
          dark: '#0a0a1a',
          glow: '#a855f7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
