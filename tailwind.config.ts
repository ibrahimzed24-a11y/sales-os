import type { Config } from 'tailwindcss';

const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        panel: c('panel'),
        raised: c('raised'),
        line: c('line'),
        fg: c('fg'),
        muted: c('muted'),
        brand: c('brand'),
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-cairo)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
