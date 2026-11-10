import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import { CHARTE } from './src/lib/charte';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marine: CHARTE.marine,
        primaire: CHARTE.primaire,
        gris: CHARTE.gris,
      },
      fontFamily: {
        cabinet: ['"Century Gothic"', '"CenturyGothic"', '"AppleGothic"', '"Questrial"', 'sans-serif'],
      },
    },
  },
  plugins: [animate],
};

export default config;
