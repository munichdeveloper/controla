'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brand } from '@/components/Brand';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSuccess(true);
      } else {
        const errorText = await response.text();
        setError(errorText || 'Ein Fehler ist aufgetreten');
      }
    } catch (err: any) {
      setError('Netzwerkfehler. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Brand className="text-2xl" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-semibold text-foreground tracking-tight">
            Passwort vergessen
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            Geben Sie Ihre E-Mail-Adresse ein, um Ihr Passwort zurückzusetzen
          </p>
        </div>

        <div className="bg-card shadow-panel border border-border rounded-2xl p-8">
          {success ? (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 text-primary px-4 py-3 rounded-lg">
                <p className="font-medium">✓ E-Mail gesendet</p>
                <p className="text-sm mt-1">
                  Falls die E-Mail-Adresse in unserem System existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet.
                </p>
              </div>
              <Link
                href="/login"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                Zurück zur Anmeldung
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-muted mb-1">
                  E-Mail-Adresse
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors sm:text-sm"
                  placeholder="name@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sende...' : 'Passwort zurücksetzen'}
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

