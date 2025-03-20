import type { Config } from 'tailwindcss';
import type { DefaultColors } from 'tailwindcss/types/generated/colors';

// const themeDark = (colors: DefaultColors) => ({
//   50: '#0a0a0a',
//   100: '#111111',
//   200: '#1c1c1c',
// });

const themeDark = (colors: DefaultColors) => ({
  50: '#0a1f44',  // Dark Navy Blue
  100: '#081a37', // Slightly Darker Blue
  200: '#06132a', // Deepest Dark Blue
});


// const themeLight = (colors: DefaultColors) => ({
//   50: '#fcfcf9',
//   100: '#f3f3ee',
//   200: '#e8e8e3',
// });

const themeLight = (colors: DefaultColors) => ({
  50: '#e0f7fa',  // Lightest Blue
  100: '#b2ebf2', // Lighter Blue
  200: '#80deea', // Slightly Darker Blue
});


const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderColor: ({ colors }) => {
        return {
          light: themeLight(colors),
          dark: themeDark(colors),
        };
      },
      colors: ({ colors }) => {
        const colorsDark = themeDark(colors);
        const colorsLight = themeLight(colors);

        return {
          dark: {
            primary: colorsDark[50],
            secondary: colorsDark[100],
            ...colorsDark,
          },
          light: {
            primary: colorsLight[50],
            secondary: colorsLight[100],
            ...colorsLight,
          },
        };
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
