/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#065F46',
          light: '#047857',
          dark: '#064E3B',
        },
        action: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
        },
        expense: {
          DEFAULT: '#EF4444',
          light: '#F87171',
          dark: '#DC2626',
        },
        gold: {
          DEFAULT: '#D97706',
          light: '#F59E0B',
          dark: '#B45309',
        },
        background: {
          DEFAULT: '#F8FAFC',
          secondary: '#F1F5F9',
        },
      },
    },
  },
  plugins: [],
};
