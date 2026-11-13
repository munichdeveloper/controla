'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Brand } from '@/components/Brand';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '/api';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Kein Token gefunden');
      setValidating(false);
      return;
    }

    // Validiere Token
    fetch(`${API_BASE_URL}/auth/validate-reset-token?token=${token}`)
      .then((response) => {
        if (response.ok) {
          setTokenValid(true);
        } else {
          setError('Der Link ist ungültig oder abgelaufen');
        }
      })
      .catch(() => {
        setError('Fehler bei der Token-Validierung');
      })
      .finally(() => {
        setValidating(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        const errorText = await response.text();
        setError(errorText || 'Fehler beim Zurücksetzen des Passworts');
      }
    } catch (err: any) {
      setError('Netzwerkfehler. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted">Validiere Token...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-card shadow-panel border border-border rounded-2xl p-8">
            <div className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
            <Link
              href="/forgot-password"
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover transition-colors"
            >
              Neuen Link anfordern
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Brand className="text-2xl" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-semibold text-foreground tracking-tight">
            Neues Passwort setzen
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            Geben Sie Ihr neues Passwort ein
          </p>
        </div>

        <div className="bg-card shadow-panel border border-border rounded-2xl p-8">
          {success ? (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 text-primary px-4 py-3 rounded-lg">
                <p className="font-medium">✓ Passwort erfolgreich zurückgesetzt</p>
                <p className="text-sm mt-1">
                  Sie werden in wenigen Sekunden zur Anmeldeseite weitergeleitet...
                </p>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-muted mb-1">
                  Neues Passwort
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors sm:text-sm"
                  placeholder="Mindestens 6 Zeichen"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted mb-1">
                  Passwort bestätigen
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors sm:text-sm"
                  placeholder="Passwort wiederholen"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Setze Passwort...' : 'Passwort zurücksetzen'}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-primary hover:text-primary transition-colors"
                >
                  ← Zurück zur Anmeldung
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted">Lade...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

