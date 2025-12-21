'use client';

import Link from 'next/link';

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PremiumPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 mb-4">
          Wählen Sie den passenden Plan
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Starten Sie kostenlos und skalieren Sie mit unseren Business-Funktionen für professionelles Instanz-Management.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Community Plan */}
        <div className="rounded-3xl p-8 ring-1 ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-zinc-900/50 backdrop-blur-sm">
          <h3 className="text-lg font-semibold leading-8 text-zinc-900 dark:text-zinc-100">Community Edition</h3>
          <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Perfekt für den Einstieg und kleine Setups.
          </p>
          <div className="mt-6 flex items-baseline gap-x-1">
            <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">0€</span>
            <span className="text-sm font-semibold leading-6 text-zinc-600 dark:text-zinc-400">/ Monat</span>
          </div>
          <Link
            href="/"
            className="mt-6 block rounded-full py-2 px-3 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 transition-colors"
          >
            Aktueller Plan
          </Link>
          <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <li className="flex gap-x-3">
                         <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
                         Bis zu 3 Instanzen
                       </li>
                        <li className="flex gap-x-3">
                                     <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
Self-Hosting
                                   </li>
            <li className="flex gap-x-3">
              <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
              Basis-Monitoring
            </li>
            <li className="flex gap-x-3">
              <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
              Basis E-Mail Alerts
            </li>
          </ul>
        </div>

        {/* Premium Plan */}
        <div className="relative rounded-3xl p-8 bg-zinc-900 dark:bg-white/5 ring-1 ring-white/10 shadow-2xl backdrop-blur-sm">

          <div className="absolute -top-3 left-0 right-0 flex justify-center">
             <span className="inline-flex items-center rounded-full bg-zinc-900 px-4 py-1 text-xs font-bold text-emerald-400 ring-1 ring-inset ring-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] tracking-wider">
               EMPFOHLEN
             </span>
          </div>

          <div className="relative">
            <h3 className="text-lg font-semibold leading-8 text-white">Business Edition</h3>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Für Power-User und Agenturen, die mehr Kontrolle benötigen.
            </p>
            <div className="mt-6 flex items-baseline gap-x-1">
              <span className="text-4xl font-bold tracking-tight text-white">49€</span>
              <span className="text-sm font-semibold leading-6 text-zinc-400">/ Monat</span>
            </div>
            <button
              onClick={() => alert('Upgrade-Funktion folgt in Kürze!')}
              className="mt-6 block w-full rounded-full bg-emerald-500/10 py-2 px-3 text-center text-sm font-semibold leading-6 text-emerald-400 shadow-sm hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition-colors"
            >
              Jetzt Upgraden
            </button>
            <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-zinc-300">
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Cloud Version (Hosting inklusive)
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Unbegrenzte Instanzen
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Erweitertes Monitoring & Alerts
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Detaillierte Analytics & Reports
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Automatische Backups
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

