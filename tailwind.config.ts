import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marine: '#0E2A42',
        primaire: '#2784C6',
        gris: '#B2B2B1',
      },
      fontFamily: {
        cabinet: ['"Century Gothic"', '"CenturyGothic"', '"AppleGothic"', '"Questrial"', 'sans-serif'],
      },
    },
  },
  plugins: [animate],
};

export default config;
