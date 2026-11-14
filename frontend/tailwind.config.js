/** @type {import('tailwindcss').Config} */

// Semantic colors are CSS variables (RGB channels) defined in
// src/app/globals.css. They mirror the design tokens of controla.dev
// (nim-landing-page app/globals.css), so light and dark mode switch by
// changing the variables, not by `dark:` classes in components.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: token('card'),
        soft: token('soft'),
        border: token('border'),
        muted: token('muted'),
        primary: {
          DEFAULT: token('primary'),
          hover: token('primary-hover'),
        },
        'on-primary': token('on-primary'),
        danger: token('danger'),
        warning: token('warning'),
        terminal: {
          DEFAULT: token('terminal'),
          fg: token('terminal-fg'),
          muted: token('terminal-muted'),
          warn: token('terminal-warn'),
          err: token('terminal-err'),
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 20px 60px -35px rgb(var(--shadow) / 0.25)',
      },
    },
  },
  plugins: [],
};
