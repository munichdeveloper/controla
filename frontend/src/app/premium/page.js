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
          Wähle den passenden Plan
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
          <a href="https://github.com/munichdeveloper/controla" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">Starte kostenlos</a> und skaliere mit unseren Business-Funktionen für professionelles Instanz-Management.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Community Plan */}
        <div className="rounded-3xl p-8 ring-1 ring-zinc-200 dark:ring-zinc-800 bg-white dark:bg-zinc-900/50 backdrop-blur-sm">
          <div className="min-h-[220px]">
            <h3 className="text-lg font-semibold leading-8 text-zinc-900 dark:text-zinc-100">Community Edition</h3>
            <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Perfekt für den Einstieg und kleine Setups.
            </p>
            <div className="mt-6 flex items-baseline justify-center gap-x-1">
              <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">0€</span>
              <span className="text-sm font-semibold leading-6 text-zinc-600 dark:text-zinc-400">/ Monat</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-500">
              Keine verteckten Kosten, kostenlos für immer.
            </p>
          </div>
          <a
            href="https://github.com/munichdeveloper/controla"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block rounded-full py-2 px-3 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 transition-colors"
          >
            Hier starten
          </a>
          <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <li className="flex gap-x-3">
              <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
              Bis zu 3 Instanzen
            </li>
            <li className="flex gap-x-3">
              <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
              Health Monitoring
            </li>
            <li className="flex gap-x-3">
              <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
              Workflow-Übersicht
            </li>
            <li className="flex gap-x-3">
              <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
              Fehlerübersicht (Light)
            </li>
            <li className="flex gap-x-3">
              <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
              Wichtige KPIs (Executions, Fehler)
            </li>
            <li className="flex gap-x-3">
              <CheckIcon className="h-6 w-5 flex-none text-zinc-600 dark:text-zinc-400" />
              Workflow Export
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
            <div className="min-h-[220px]">
              <h3 className="text-lg font-semibold leading-8 text-emerald-400">Hosted Ops</h3>
              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Für Power-User und Agenturen, die mehr Kontrolle benötigen.
              </p>
              <div className="mt-6 flex items-baseline justify-center gap-x-1">
                <span className="text-4xl font-bold tracking-tight text-white">ab 35€</span>
                <span className="text-sm font-semibold leading-6 text-zinc-400">/ Monat *</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                * 1 Hauptnutzer, jeder weitere Nutzer 5 € / Monat zusätzlich (bis zu 5 User max.). 35 € / Monat gilt für Jahresabo.
              </p>
            </div>
            <a
              href="https://controla.dev/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block w-full rounded-full bg-emerald-500/10 py-2 px-3 text-center text-sm font-semibold leading-6 text-emerald-400 shadow-sm hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition-colors"
            >
              Jetzt Upgraden
            </a>
            <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-zinc-300">
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Unbegrenzt viele Instanzen
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Detaillierte Execution Logs
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Credential- & Token-Monitoring
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Performance-Historie
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Workflow-Fehler Alerts
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Automatische Backups
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                Workflow Export & Import
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                bis zu 5 Nutzer
              </li>
              <li className="flex gap-x-3">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                API
              </li>
              <li className="flex gap-x-3 text-emerald-400 font-bold">
                <CheckIcon className="h-6 w-5 flex-none text-emerald-400" />
                AI Tools - Coming soon
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
