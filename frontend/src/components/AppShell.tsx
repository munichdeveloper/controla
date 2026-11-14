'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
import { ThemeProvider } from '@/lib/theme/ThemeContext';
import { LicenseProvider, useLicense } from '@/lib/license/LicenseContext';
import { editionLabel, HOSTED_OFFER_NAME } from '@/lib/license/edition';
import { getVersion } from '@/lib/api';
import { Brand } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FEATURES } from '@/lib/license/features';

const allLinks = [
  { label: 'Instanzen', href: '/' },
  { label: 'Alerts', href: '/settings/alerts' },
  // Hosted plans without scheduled backups hide the entry; CE keeps it as upgrade teaser.
  { label: 'Backups', href: '/settings/backups', feature: FEATURES.BACKUP_SCHEDULED },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/' || pathname.startsWith('/instances');
  return pathname.startsWith(href);
}

export function EditionChip() {
  const { license, isPremium } = useLicense();
  if (!license) return null;
  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${
        isPremium ? 'border-primary/30 text-primary' : 'border-border text-muted'
      }`}
    >
      {editionLabel(license, isPremium)}
    </span>
  );
}

function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();
  const { isPremium, isFeatureEnabled, showLockedFeatures } = useLicense();
  const pathname = usePathname();
  const links = allLinks.filter((link) => !('feature' in link) || showLockedFeatures || isFeatureEnabled(link.feature));
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex min-h-16 items-center justify-between gap-6 py-3">
          <div className="flex items-center gap-8">
            <Link href="/" aria-label="Controla Instanzübersicht" className="flex items-center gap-3">
              <Brand />
              <span className="hidden sm:inline"><EditionChip /></span>
            </Link>
            <nav aria-label="Hauptnavigation" className="hidden items-center gap-1 md:flex">
              {links.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                      active ? 'bg-soft font-medium text-foreground' : 'text-muted hover:text-primary'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {!isPremium && (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://www.controla.dev/pricing"
                className="hidden rounded-lg border border-primary/30 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 lg:inline-flex"
              >
                Upgrade
              </a>
            )}
            <ThemeToggle />
            <span className="hidden max-w-[14rem] truncate text-sm text-muted lg:inline" title={user?.username}>
              {user?.username}
            </span>
            <button
              type="button"
              onClick={logout}
              className="hidden h-10 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:border-danger hover:text-danger md:inline-flex md:items-center"
            >
              Abmelden
            </button>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen((value) => !value)}
              className="h-10 rounded-lg border border-border px-4 text-sm md:hidden"
            >
              {open ? 'Schließen' : 'Menü'}
            </button>
          </div>
        </div>
        <div id="mobile-navigation" hidden={!open} className="pb-4 md:hidden">
          <div className="grid gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                className="rounded-lg px-3 py-3 text-muted hover:bg-soft aria-[current=page]:bg-soft aria-[current=page]:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border px-3 pt-3 text-sm text-muted">
              <span className="truncate">{user?.username}</span>
              <button type="button" onClick={logout} className="rounded-lg border border-border px-4 py-2 font-medium text-foreground">
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { isAuthenticated } = useAuth();
  const { isPremium } = useLicense();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    // Nur laden wenn authentifiziert und Premium
    if (isAuthenticated && isPremium && typeof window !== 'undefined') {
      // Kurze Verzögerung um sicherzustellen, dass das Token verfügbar ist
      const timer = setTimeout(() => {
        getVersion()
          .then((info) => setVersion(info.version))
          .catch((err) => console.error('Failed to fetch version', err));
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isPremium]);

  if (!isAuthenticated || !isPremium) {
    return null;
  }

  return (
    <footer className="mt-auto border-t border-border py-5">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 text-xs text-muted sm:px-8">
        <span>Controla · {HOSTED_OFFER_NAME}</span>
        {version ? (
          <span className="font-mono">v{version}</span>
        ) : (
          <span className="h-3 w-16 animate-pulse rounded bg-soft" />
        )}
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 Minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LicenseProvider>
          <ThemeProvider>
            <div className="flex min-h-screen flex-col">
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:block focus:bg-foreground focus:p-4 focus:text-background"
              >
                Zum Inhalt springen
              </a>
              <Navigation />
              <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8">
                {children}
              </main>
              <Footer />
            </div>
          </ThemeProvider>
        </LicenseProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
