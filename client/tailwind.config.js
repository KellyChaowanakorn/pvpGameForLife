/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        stake: {
          bg: '#0F212E',
          card: '#1A2C38',
          hover: '#213743',
          border: '#2F4553',
          gray: '#7B8A95',
          gray2: '#557086',
        },
        neon: '#00E701',
        danger: '#F53B57',
        gold: '#FFC107',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
