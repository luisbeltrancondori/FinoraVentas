/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17221f',
        muted: '#718078',
        canvas: '#f7f9f8',
        brand: {
          DEFAULT: '#059669',
          dark: '#047857',
          light: '#ecfdf5',
        },
      },
      boxShadow: {
        panel: '0 1px 3px rgba(15, 23, 42, 0.04)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
