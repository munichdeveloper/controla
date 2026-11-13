'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLicense } from '@/lib/license/LicenseContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { Skeleton } from '@/components/Skeleton';
import { ApiConnectionToast } from '@/components/ApiConnectionToast';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { license, isPremium, loading: licenseLoading } = useLicense();
  const router = useRouter();
  const licenseReady = !licenseLoading && !!license;
  // Before hydration, React cannot prevent native form submissions.
  // Only attach the controls to a form once the license has loaded.
  const FormContainer = licenseReady ? 'form' : 'div';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !licenseReady) return;

    setError('');
    setLoading(true);

    try {
      await login(username, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <ApiConnectionToast />
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Brand className="text-2xl" />
          </div>
          <div className="mt-2 text-center text-sm text-muted flex justify-center">
            {licenseLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : isPremium ? (
              <span className="font-semibold text-primary">
                Hosted Ops
              </span>
            ) : (
              license?.edition || 'Community Edition'
            )}
          </div>
        </div>
        <div className="bg-card shadow-panel border border-border rounded-2xl p-8">
          <div className="mb-6 text-center">
            <h3 className="text-lg font-medium text-foreground">Anmelden</h3>
          </div>

          <FormContainer method={licenseReady ? 'post' : undefined} onSubmit={handleSubmit}>
            <fieldset className="space-y-6" disabled={!licenseReady || loading}>
              {error && (
                <div className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-muted mb-1">
                  {licenseLoading ? <Skeleton className="h-4 w-24" /> : (isPremium ? 'E-Mail' : 'Benutzername')}
                </label>
                <input
                  id="username"
                  name="username"
                  type={isPremium ? 'email' : 'text'}
                  required
                  disabled={!isPremium || licenseLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`mt-1 block w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors sm:text-sm ${!isPremium && !licenseLoading ? ' text-muted cursor-not-allowed' : ''}`}
                  placeholder={licenseLoading ? '' : (isPremium ? 'name@example.com' : 'admin')}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-muted">
                    Passwort
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary hover:text-primary transition-colors"
                  >
                    Passwort vergessen?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors sm:text-sm"
                />
              </div>

              <button
                type={licenseReady ? 'submit' : 'button'}
                disabled={loading || !licenseReady}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Lade...' : 'Anmelden'}
              </button>
            </fieldset>
          </FormContainer>
        </div>
      </div>
    </div>
  );
}
