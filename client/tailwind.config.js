/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cute: {
          bg: '#FFF8F0',
          card: '#FFFFFF',
          pink: '#FF6B9D',
          purple: '#A855F7',
          blue: '#4FC3F7',
          mint: '#4ADE80',
          gold: '#FFD93D',
          orange: '#FF8C42',
          red: '#F87171',
          dark: '#3D2914',
          gray: '#9CA3AF',
          border: '#F3E8DE',
          soft: '#FFF0E6',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
