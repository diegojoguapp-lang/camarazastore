/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        crema: '#F6F2E9',
        cremaDark: '#ECE5D6',
        tinta: '#1C1B19',
        humo: '#6B675E',
        oliva: '#3F4A2E',
        olivaLight: '#5A6840',
        dorado: '#B6924A',
        doradoSoft: '#D9C48F',
        wa: '#25D366',
        waDark: '#1da851',
        linea: '#E2DACA',
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,27,25,.04), 0 8px 24px -12px rgba(28,27,25,.12)',
        cardHover: '0 2px 4px rgba(28,27,25,.06), 0 16px 40px -16px rgba(28,27,25,.22)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
