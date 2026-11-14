# Frontend-Migration: Next 16 und React 19

Umsetzung von [#27](https://github.com/munichdeveloper/controla/issues/27),
Schritt 4 im [Upgrade-Plan #23](https://github.com/munichdeveloper/controla/issues/23).

## Umfang und Verhalten

Next.js und eslint-config-next werden gemeinsam auf **16.4.5**, React/React DOM
auf **19.3.1** und deren Typen auf **19.3.0** gebracht. ESLint **9.39.5** nutzt
`frontend/eslint.config.mjs`; `npm run lint` ruft ESLint direkt auf, weil Next 16
`next lint` und die integrierte Build-Prüfung entfernt hat. CI führt Lint separat
und verpflichtend aus. Node **24.22.0** und npm **11.9.0** stammen aus Schritt 3.
TypeScript **5.9.3**, Vitest **3.2.7**, date-fns **3.6.0** und Tailwind **3.4.19**
bleiben erhalten; ihre Major-Upgrades gehören in eigene Tickets.

Der Produktionsbuild verwendet den Next-16-Standardbundler Turbopack und weiter
`output: 'standalone'`. Dynamische Instanzseiten lesen ihre ID mit `useParams()`;
synchrone Zugriffe auf die inzwischen asynchronen Seitenparameter entfallen.
`react-jsx` und die generierten Entwicklungstypen sind in `tsconfig.json`
berücksichtigt. Interne Headerlinks verwenden `next/link`.

Clientnavigation erhält Provider und Query-Cache. Ein Browsertest reproduzierte,
dass nach einem Kontowechsel noch Instanzen des vorherigen Kontos angezeigt
wurden. Login und Logout leeren deshalb den Query-Cache; Logout entfernt den
Token und navigiert mit `router.replace('/login')` zur Anmeldung. Das gilt auch
beim Logout auf einer Instanzseite. Die Login-/Hydration-Korrekturen aus #18/#19
bleiben bestehen: Vor Hydration und erfolgreicher Lizenzabfrage gibt es kein
absendbares Formular; Zugangsdaten werden erst danach per POST übertragen.
Cookie-Auth (#20), Backend-Verträge, JWT-Format und Datenbankschema werden nicht
geändert.

## Reproduzierbare Prüfungen

Mit der festgelegten Node-/npm-Version im Verzeichnis `frontend`:

```sh
npm ci
npm run lint
npm test
npm run build
npm run typecheck
npx playwright install --with-deps chromium
npm run test:e2e
npm audit --omit=dev
npm audit
```

Der Build erzeugt vor dem Typecheck die Next-Routentypen. Die Browserprüfung
startet den gebauten Standalone-Server auf `127.0.0.1:3027` mit derselben Anordnung
von Server und statischen Dateien wie im Docker-Image. Sie benötigt keinen
laufenden Entwicklungsserver. Optional kann lokal ein vorhandenes Chromium mit
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/pfad/zu/chromium` verwendet werden; CI
installiert die zur Playwright-Version gehörende Browserrevision.

`frontend/e2e/` enthält 21 Chromium-Regressionstests für:

- Login ohne JavaScript, langsame/fehlgeschlagene Lizenzabfrage, falsches und
  richtiges Passwort, POST statt Zugangsdaten in GET-URLs;
- Session nach Reload, Logout einschließlich Browser-Zurück und getrennte
  Query-Daten bei einem Wechsel zwischen zwei Konten;
- Dashboard, Instanz anlegen/lesen/bearbeiten, direkte dynamische URLs,
  Workflows, Clientnavigation und Zurück/Vor;
- Alerts und Backups mit erneutem Abruf der Serverwerte, Speicherfehler,
  CE-/Premium-Gates und fehlende Feature-Keys;
- Dark-Mode-Persistenz sowie Passwort-Reset mit gültigem, ungültigem und
  fehlendem Token und die Anfrage einer Reset-Mail.

Die Tests scheitern bei JavaScript-/Hydration-Fehlern, unerwarteten API-Aufrufen
und Zugangsdaten in GET-URLs. Beide Editionen verwenden **simulierte
API-Verträge**, keine laufende Premium-Installation. Insbesondere bestätigen
Premium-Backups nur das Verhalten des gemeinsamen Frontends bei passenden
Antworten. Ein reales Premium-Staging samt Mailzustellung und externen
Integrationen bleibt vor dem SaaS-Rollout zu prüfen. Fehler-Traces und
Screenshots mit ausschließlich Testdaten werden in der PR-CI sieben Tage
aufbewahrt.

Vom Repository-Root prüft `mvn -B clean verify` mit Java 17 den gesamten Reactor,
einschließlich der PostgreSQL-Tests bei laufendem Docker-Daemon. Die PR-CI baut
außerdem das vollständige Image und führt
`python3 .github/scripts/smoke-docker.py controla:ci` aus: echte PostgreSQL-
Initialisierung, CE-Backendstart, generiertes Adminpasswort, Login und
authentifizierte/abgewiesene API-Aufrufe über den Next-Standalone-Rewrite sowie
HTML-, JavaScript- und CSS-Auslieferung. Das Image muss dafür zuvor mit
`docker build --tag controla:ci .` gebaut werden.

## Browser und verbleibende Befunde

Die Mindestziele von Next 16 sind Chrome/Edge/Firefox **111+** und Safari
**16.4+**. Die automatisierten Tests verwenden Chromium; sie sind kein Nachweis
für Safari oder Firefox. Bei entsprechenden Kundenvorgaben diese Browser im
Staging zusätzlich prüfen.

ESLint meldet derzeit **0 Fehler und 11 Warnungen**: zehn Hinweise der neuen
Regel `react-hooks/set-state-in-effect` auf bestehende Mount-Initialisierung
bzw. Formularsynchronisierung und einen Hinweis auf die bestehende vollständige
Navigation beim API-401. Erstere Regel bleibt explizit als Warnung sichtbar;
eine umfassende Zustandsverwaltungsmigration ist nicht Teil dieses Upgrades.
Die übrigen Next-/React-Regeln behalten ihre Fehlerstufe.

Audit am 04.11.2026 mit dem committed Lockfile: **0 Produktionsbefunde**.
Der vollständige Audit meldet 2 critical und 9 moderate betroffene
Entwicklungspakete (keine entsprechend vielen unabhängigen Schwachstellen):

- Vitest/tinypool und `@vitest/mocker`: Worker-Options-/Prototype-Pollution-
  sowie Mock-Server-Pfad-/Codeinjektionsbefunde. Sie betreffen den Testprozess,
  sind keine Produktionsabhängigkeiten und werden separat in
  [#28](https://github.com/munichdeveloper/controla/issues/28) aktualisiert.
  Die Prüfung hier verwendet `vitest run` ohne öffentlich gestarteten Testserver.
- ESLint/TypeScript-ESLint zieht ein von einem moderaten ReDoS-Befund betroffenes
  minimatch ein. Das betrifft das Lint-Werkzeug und nicht den ausgelieferten
  Server. Die Audit-Empfehlung würde eslint-config-next auf eine andere Major-
  Linie zurücksetzen; sie wird nicht blind übernommen. Keine erzwungenen
  Overrides. Weitere Befunde bleiben im bestehenden Quality-Prozess (#7) sichtbar.

## Gestufter Rollout und Rückkehr

1. Vor Merge müssen die drei PR-CI-Jobs (Reactor, Frontend einschließlich
   Browsertests, vollständiges Docker-Image mit HTTP-Smoke-Test) grün sein.
   Image-Version/Digest der bisher eingesetzten Version für den Rückweg sichern.
2. Zunächst eine CE-Testinstallation mit der neuen Image-Version starten.
   Anmeldung mit bestehendem Konto, Session nach Reload, Logout, Instanzdaten,
   Alerts, direkte Instanz-URL sowie statische Dateien über den tatsächlich
   eingesetzten Reverse Proxy prüfen. Browserkonsole und Serverlogs auf
   Hydration-Fehler, fehlgeschlagene Chunks und API-5xx kontrollieren.
3. Vor SaaS-Rollout dasselbe Frontend gegen das tatsächlich eingesetzte
   Premium-Backend im Staging prüfen: zwei getrennte Konten/Mandanten, aktuelle
   Lizenz-/Feature-Antworten, Alerts, Backups und Passwort-Reset samt Mail.
   Die simulierten Verträge ersetzen diesen Integrationsnachweis nicht.
4. Danach eine begrenzte erste Installation/Benutzergruppe aktualisieren.
   Bei unauffälligem Login-, Navigations- und API-Verhalten den Einsatz erweitern.
   Bei neuen Auth-/Hydration-/Chunkfehlern oder 5xx-Anstieg stoppen und zurückkehren.
5. Für den Rollback die vorherige Image-Version mit denselben Umgebungsvariablen
   und Datenvolumes starten und Browser vollständig neu laden (alte Client-
   Chunks nicht mit dem neuen Server mischen). Bestehende JWTs bleiben im selben
   Format; Login/Session danach erneut prüfen. Dieses Paket benötigt keine
   Datenbankmigration und keinen Datenbank-Rollback. Der vorherige Stand enthält
   die alten Next-Sicherheitsbefunde und dient daher nur der kurzfristigen
   Wiederherstellung bis zur Korrektur.
