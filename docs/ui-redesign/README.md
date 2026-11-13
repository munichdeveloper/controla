# App-Design nach controla.dev

Die App (CE und Managed Hosting teilen sich `frontend/`) übernimmt das Designsystem der Website controla.dev (Repo `nim-landing-page`, `app/globals.css`, `components/Brand.tsx`, `components/InstancePreview.tsx`).

## Tokens

- Quelle der Farben ist die Website. In der App stehen sie als RGB-Kanäle in `frontend/src/app/globals.css` (`:root` hell, `:root.dark` dunkel), damit Tailwind-Opazitäten wie `bg-danger/5` funktionieren.
- `frontend/tailwind.config.js` bildet sie auf semantische Klassen ab: `background`, `foreground`, `card`, `soft`, `border`, `muted`, `primary` (+ `primary-hover`, `on-primary`), `danger`, `warning`, `terminal-*` (Log-Ansichten, in beiden Themes dunkel).
- Komponenten nutzen nur diese Klassen. Hell/Dunkel wechselt über die Variablen, `dark:`-Klassen braucht es nicht mehr (Ausnahme: Icon-Wechsel im Theme-Schalter).
- Ändert sich die Website-Palette, beide Dateien gemeinsam anpassen.

## Typografie und Bausteine

- Inter (Text), Space Grotesk (Überschriften, Kennzahlen), JetBrains Mono (Labels, Versionen, URLs); lokal unter `frontend/src/app/fonts/` (SIL OFL 1.1, Lizenztexte in `LICENSE.txt`).
- `components/Brand.tsx`: Wortmarke wie auf der Website. `components/PageHeader.tsx`: Mono-Eyebrow, Titel, Lead-Text. `components/AppShell.tsx`: Kopfzeile, Navigation, Footer.
- Muster: Karten `rounded-xl border border-border bg-card`, Primärbutton `rounded-lg bg-primary text-on-primary`, Sekundärbutton `rounded-lg border border-border`, Labels `font-mono text-[10px] uppercase tracking-wide text-muted`.

## Screenshots

Vorher/Nachher mit Beispieldaten (lokaler Dev-Server, API per Playwright gemockt): `dashboard-light.png`, `dashboard-dark.png`, `instance-light.png` (Managed Hosting), `alerts-light.png`, `backups-dark.png`, `login-light.png`, `dashboard-mobile.png`, `instance-tabs-*.png`.
