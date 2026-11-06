'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
import { ThemeProvider, useTheme } from '@/lib/theme/ThemeContext';
import { LicenseProvider, useLicense } from '@/lib/license/LicenseContext';
import { usePathname } from 'next/navigation';
import { getVersion } from '@/lib/api';
import BrandMark from '@/components/BrandMark';
import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';

function ThemeToggle() {
  const { toggleTheme } = useTheme();

  // Icons follow the `dark` class (set before paint), so they are right
  // from the first frame and match on server and client.
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Zwischen hellem und dunklem Design wechseln"
      title="Hell / Dunkel"
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-emerald-600 dark:hover:border-emerald-400 transition-colors"
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

const navItems = [
  ['/', 'Dashboard'],
  ['/settings/alerts', 'Alerts'],
  ['/settings/backups', 'Backups'],
];

function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();
  const { license, isPremium } = useLicense();
  const pathname = usePathname();

  if (!isAuthenticated) {
    return null;
  }

  const isActive = (href) =>
    href === '/' ? pathname === '/' || pathname?.startsWith('/instances') : pathname?.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <h1 className="m-0">
          <a href="/" className="flex items-center gap-2.5 text-gray-900 dark:text-zinc-100">
            <BrandMark />
            <span className="font-display text-xl font-bold tracking-tight">controla</span>
            <span className="ml-1 hidden sm:inline rounded-full border border-gray-200 dark:border-zinc-700 px-2.5 py-0.5 font-mono text-[11px] font-normal uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              {isPremium ? 'Hosted Ops' : license?.edition || 'Community Edition'}
            </span>
          </a>
        </h1>
        <nav aria-label="Hauptnavigation" className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 flex gap-1 overflow-x-auto">
          {navItems.map(([href, label]) => (
            <a
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(href)
                  ? 'bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {!isPremium && (
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://www.controla.dev/pricing"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 dark:border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
            >
              Upgrade
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3.5 w-3.5">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          )}
          <ThemeToggle />
          <span className="hidden md:inline font-mono text-xs text-gray-500 dark:text-zinc-400">
            {user?.username}
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:border-red-600 hover:text-red-600 dark:hover:border-red-400 dark:hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { isAuthenticated } = useAuth();
  const { isPremium } = useLicense();
  const [version, setVersion] = useState(null);

  useEffect(() => {
    // Nur laden wenn authentifiziert und Premium
    if (isAuthenticated && isPremium && typeof window !== 'undefined') {
      // Kurze Verzögerung um sicherzustellen, dass das Token verfügbar ist
      const timer = setTimeout(() => {
        getVersion()
          .then((info) => {
            setVersion(info.version);
          })
          .catch((err) => {
            console.error('Failed to fetch version', err);
          });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isPremium]);

  if (!isAuthenticated || !isPremium) {
    return null;
  }

  return (
    <footer className="border-t border-gray-200 dark:border-zinc-700 py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          {version ? (
            <span className="font-mono text-xs text-gray-500 dark:text-zinc-400">
              Version <span className="text-gray-700 dark:text-zinc-300">{version}</span>
            </span>
          ) : (
            <div className="w-20 h-3 bg-gray-200 dark:bg-zinc-700 animate-pulse rounded"></div>
          )}
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 Minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <html lang="de" className="h-full" suppressHydrationWarning>
      <head>
        <title>Controla - Community Edition</title>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="bg-gray-50 dark:bg-zinc-900 font-sans transition-colors duration-200 min-h-full antialiased">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LicenseProvider>
              <ThemeProvider>
                <div className="min-h-screen flex flex-col">
                  <Navigation />
                  <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                    {children}
                  </main>
                  <Footer />
                </div>
              </ThemeProvider>
            </LicenseProvider>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
