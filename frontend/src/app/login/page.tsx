'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLicense } from '@/lib/license/LicenseContext';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/Skeleton';

export default function LoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { license, isPremium, loading: licenseLoading } = useLicense();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            n8n Instance Manager
          </h2>
          <div className="mt-2 text-center text-sm text-gray-600 dark:text-zinc-400 flex justify-center">
            {licenseLoading ? (
              <Skeleton className="h-5 w-32" />
            ) : isPremium ? (
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
                Business Edition
              </span>
            ) : (
              license?.edition || 'Community Edition'
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 shadow-xl dark:shadow-2xl border border-gray-200 dark:border-white/10 rounded-xl p-8 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-zinc-100">Anmelden</h3>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
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
                className={`mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 dark:bg-zinc-950 dark:text-zinc-100 transition-colors sm:text-sm ${!isPremium && !licenseLoading ? 'dark:bg-zinc-950/50 dark:text-zinc-400 text-gray-500 cursor-not-allowed' : ''}`}
                placeholder={licenseLoading ? '' : (isPremium ? 'name@example.com' : 'admin')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Passwort
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:focus:ring-emerald-500/50 focus:border-emerald-500 dark:focus:border-emerald-500 dark:bg-zinc-950 dark:text-zinc-100 transition-colors sm:text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Lade...' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
