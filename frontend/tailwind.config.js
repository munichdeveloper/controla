/** @type {import('tailwindcss').Config} */

// "Kontrollraum" design: the same palette and type as controla.dev.
// The app's components use Tailwind's gray (light mode), zinc (dark mode)
// and emerald (brand) utilities, so the brand lives in those scales instead
// of in per-component classes:
//   gray    – light neutrals:  bg #F5F6F3, border #D9DED8, text #0D1215
//   zinc    – dark graphite:   page #0A0D10, card #141A20, text #E8EDF1
//   emerald – signal green:    #0C7A52 on light, #3DDC97 on dark
//   amber / red – warning and error tones with readable text shades
const gray = {
  50: '#F5F6F3',
  100: '#EDF0EC',
  200: '#D9DED8',
  300: '#C2C9C3',
  400: '#78838B',
  500: '#56616A',
  600: '#4F5B63',
  700: '#354047',
  800: '#1F282E',
  900: '#0D1215',
  950: '#070A0C',
};

const zinc = {
  50: '#F4F7F9',
  100: '#E8EDF1',
  200: '#D5DDE3',
  300: '#BCC7D0',
  400: '#97A4B0',
  500: '#8492A0',
  600: '#3A4550',
  700: '#252E38',
  800: '#141A20',
  900: '#0A0D10',
  950: '#06080A',
};

const emerald = {
  50: '#EBFAF3',
  100: '#CFF3E2',
  200: '#A3E9C9',
  300: '#6BE6B0',
  400: '#3DDC97',
  500: '#1FB97A',
  600: '#0C7A52',
  700: '#09613F',
  800: '#0A4D34',
  900: '#0A3A28',
  950: '#04140C',
};

const amber = {
  50: '#FEF7E8',
  100: '#FCEBC6',
  200: '#F8D78E',
  300: '#F5C466',
  400: '#F2B144',
  500: '#D9951F',
  600: '#B07208',
  700: '#9A5B00',
  800: '#7A4700',
  900: '#5C3500',
  950: '#321C00',
};

const red = {
  50: '#FDF1EF',
  100: '#FBE1DD',
  200: '#F6C3BC',
  300: '#FFA39B',
  400: '#FF7A70',
  500: '#E5524A',
  600: '#B8352B',
  700: '#962A22',
  800: '#76221C',
  900: '#5A1A15',
  950: '#2E0C09',
};

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray,
        zinc,
        emerald,
        // Status colours share the brand green so "online" and primary
        // actions read as one system.
        green: emerald,
        teal: emerald,
        amber,
        yellow: amber,
        orange: amber,
        red,
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', '"Inter Variable"', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
