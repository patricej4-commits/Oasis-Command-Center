import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oasis: { DEFAULT: '#1E5B3A', dark: '#154029', light: '#E7F1EB' },
      },
    },
  },
  plugins: [],
};
export default config;
