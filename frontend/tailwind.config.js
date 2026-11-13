/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 950: '#0b0912', 900: '#100d18', 850: '#15121f', 800: '#1b1727', 700: '#252036', 600: '#332c48', 400: '#9c94b2', 300: '#c4bdd6' },
        coral: { DEFAULT: '#ff5f6d', 400: '#ff7a86' },
        violet: { DEFAULT: '#8b5cf6', 400: '#a78bfa' },
      },
      backgroundImage: { brand: 'linear-gradient(135deg,#ff5f6d 0%,#c85ab8 50%,#8b5cf6 100%)' },
      boxShadow: { glow: '0 12px 36px -12px rgba(255,95,109,.55)', card: '0 10px 40px -12px rgba(0,0,0,.6)' },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(.9)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
      },
      animation: { 'fade-up': 'fadeUp .35s ease both', pop: 'pop .25s ease both' },
    },
  },
  plugins: [],
};
