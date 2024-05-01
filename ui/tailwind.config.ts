import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors:{
        'wash': 'rgb(255 255 255)',
        'wash-dark': 'rgb(35 39 47)',
        'gray-30': 'rgb(153,161,179)',
        'gray-40': 'rgb(120,131,155)',
      }
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
