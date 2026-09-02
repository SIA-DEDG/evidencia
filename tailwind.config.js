/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#dee6ff',
          500: '#034ea2',
          600: '#023d83',
          700: '#012e66',
        },
        ink: '#10233b',
        muted: '#4c6379',
        canvas: '#f3f6fa',
        line: '#dce6f0',
      },
      boxShadow: {
        control: '0 3px 8px rgba(16, 35, 59, 0.12)',
        card: '0 12px 32px rgba(3, 78, 162, 0.08)',
      },
    },
  },
  plugins: [],
}
