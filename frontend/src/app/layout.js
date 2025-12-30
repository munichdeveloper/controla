'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
import { ThemeProvider, useTheme } from '@/lib/theme/ThemeContext';
import { LicenseProvider, useLicense } from '@/lib/license/LicenseContext';
import { getVersion } from '@/lib/api';
import './globals.css';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white focus:outline-none"
      title={theme === 'light' ? 'Dunkelmodus aktivieren' : 'Hellen Modus aktivieren'}
    >
      {theme === 'light' ? (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )}
    </button>
  );
}

function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();
  const { license, isPremium } = useLicense();


  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="bg-white dark:bg-zinc-900/80 dark:backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none transition-colors duration-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              n8n Instance Manager
              {isPremium ? (
                <span className="text-sm font-bold ml-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
                  Business Edition
                </span>
              ) : (
                <span className="text-sm text-gray-500 dark:text-zinc-500 font-normal ml-2">
                  {license?.edition || 'Community Edition'}
                </span>
              )}
            </h1>
            <nav className="mt-4 flex space-x-4">
              <a href="/" className="text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-emerald-400 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Dashboard
              </a>
              <a href="/settings/alerts" className="text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-emerald-400 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Alerts
              </a>
              <a href="/settings/backups" className="text-gray-700 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-emerald-400 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Backups
              </a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            {!isPremium && (
              <a
                href="/premium"
                className="hidden sm:flex items-center px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 mr-1.5">
                  <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
                </svg>
                Upgrade
              </a>
            )}
            <ThemeToggle />
            <span className="text-sm text-gray-600 dark:text-zinc-400 font-medium">
              {user?.username}
            </span>
            <button
              onClick={logout}
              className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 px-4 py-2 rounded-full text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
            >
              Logout
            </button>
          </div>
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
        const token = localStorage.getItem('token');
        console.log('Footer: Fetching version, token present:', !!token);

        getVersion()
          .then((info) => {
            console.log('Footer: Version fetched successfully:', info.version);
            setVersion(info.version);
          })
          .catch((err) => {
            console.error('Footer: Failed to fetch version', err);
          });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isPremium]);

  if (!isAuthenticated || !isPremium) {
    return null;
  }

  return (
    <footer className="border-t border-gray-200/60 dark:border-zinc-800/60 bg-gray-50/50 dark:bg-zinc-900/30 py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          {version ? (
            <span className="text-xs text-gray-500 dark:text-zinc-500">
              Version <span className="font-medium text-gray-600 dark:text-zinc-400">{version}</span>
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
        <title>n8n Instance Manager - Community Edition</title>
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
      <body className="bg-gray-50 dark:bg-zinc-900 transition-colors duration-200 min-h-full antialiased">
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
