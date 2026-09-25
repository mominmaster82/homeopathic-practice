/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hind Siliguri"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#effcf9',
          100: '#d6f5ee',
          200: '#b0eade',
          300: '#7ad8c8',
          400: '#3fbfaf',
          500: '#19a294',
          600: '#0e8279',
          700: '#0f6862',
          800: '#11534f',
          900: '#124542',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 10px 28px -14px rgb(15 23 42 / 0.18)',
        pop: '0 12px 44px -12px rgb(15 23 42 / 0.28)',
      },
    },
  },
  plugins: [],
};
