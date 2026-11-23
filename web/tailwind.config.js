/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#05070a',
        panel: {
          DEFAULT: 'rgba(10, 14, 18, 0.84)',
          solid: '#0a0e12',
          border: 'rgba(223, 231, 224, 0.16)',
          hover: 'rgba(223, 231, 224, 0.06)',
        },
        surface: {
          DEFAULT: '#0b1017',
          card: '#0e141e',
          hover: '#141c2b',
          border: 'rgba(223, 231, 224, 0.16)',
        },
        night: {
          950: '#030508',
          900: '#05070a',
          800: '#0a0e12',
          700: '#141a22',
          600: '#1e2733',
        },
        hmcs: {
          text: '#dfe7e0',
          muted: '#9aa5a0',
          amber: '#f5a524',
          danger: '#ff5a5f',
          info: '#7fb4c9',
          success: '#6fcf97',
        }
      },
      fontFamily: {
        sans: ['Onest', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '4px',
        lg: '6px',
      },
      boxShadow: {
        panel: '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(223, 231, 224, 0.16)',
        amber: '0 0 15px rgba(245, 165, 36, 0.3)',
      }
    },
  },
  plugins: [],
}
