/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './app.js',
    './public/**/*.{html,js}',
    './src/**/*.{ts,js,html}',
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
    },
    extend: {
      colors: {
        primary: '#1D3F8F',
        secondary: '#F28C28',
      },
    },
  },
  plugins: [],
};
