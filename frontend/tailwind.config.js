/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Figtree Variable"', 'Figtree', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Figtree Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#F5F6FA',
        card: '#FFFFFF',
        ink: '#101935',
        slate: '#5B6380',
        rule: '#DDE1EC',
        cobalt: { DEFAULT: '#2541D8', dark: '#1B32B0', soft: '#E9EDFC' },
        marker: '#FFD84D',
        right: '#12A26B',
        wrong: '#E5484D',
      },
      boxShadow: {
        pop: '0 1px 2px rgba(16,25,53,.06), 0 8px 24px -12px rgba(16,25,53,.18)',
        lift: '0 2px 4px rgba(16,25,53,.06), 0 24px 48px -20px rgba(16,25,53,.28)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        stamp: { '0%': { transform: 'scale(1.25) rotate(-6deg)', opacity: 0 }, '60%': { transform: 'scale(.96) rotate(-3deg)', opacity: 1 }, '100%': { transform: 'scale(1) rotate(-3deg)' } },
        drain: { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
      },
      animation: { rise: 'rise .25s ease both', stamp: 'stamp .5s cubic-bezier(.2,.8,.2,1) both' },
    },
  },
  plugins: [],
};
