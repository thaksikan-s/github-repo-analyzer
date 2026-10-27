/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        panel: '#0b1220',
        primary: '#6ea8fe',
        accent: '#22d3ee',
        subtle: '#111827',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(110,168,254,0.35), 0 18px 50px -12px rgba(59,130,246,0.55)',
      },
      backgroundImage: {
        grid: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.28) 1px, transparent 0)',
      },
    },
  },
  plugins: [],
};
