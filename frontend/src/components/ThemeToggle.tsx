'use client';

import { useTheme } from '@/lib/theme/ThemeContext';

// Same control as on controla.dev: bordered square button, moon in light
// mode, sun in dark mode. Icons follow the `dark` class via CSS.
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Zwischen hellem und dunklem Design wechseln"
      title="Hell / Dunkel"
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-primary ${className}`}
    >
      <svg className="h-5 w-5 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
      <svg className="hidden h-5 w-5 dark:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
    </button>
  );
}
