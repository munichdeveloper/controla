# Dependency-Update (21. Oktober 2026)

## Zielversionen

| Bereich | Vorher | Nachher |
| --- | --- | --- |
| Spring Boot / BOM / Packaging-Plugin | 3.2.5 | 3.5.16 |
| JJWT (API, Implementierung, Jackson) | 0.12.3 | 0.13.0 |
| Maven Compiler | 3.13.0 | 3.16.0 |
| Maven Surefire | implizite Maven-Vorgabe | 3.6.0 (JUnit 5 explizit unterstützt) |
| JaCoCo | 0.8.12 | 0.8.15 |
| Frontend Maven Plugin | 1.15.0 | 2.0.2 |
| Node.js | 18/20 je nach Buildpfad | 24 LTS (Maven, CI, `.nvmrc`: 24.22.0) |
| npm im Maven-Build | 10.2.4 | 11.9.0 |
| Next.js / eslint-config-next | 14.2.3 | 16.4.2 |
| React / React DOM | 18.3.1 | 19.3.1 |
| TanStack Query | 5.90.12 | 5.104.5 |
| date-fns | 3.6.0 | 4.4.0 |
| ESLint | 8.57.1 | 9.39.5 |
| TypeScript | 5.9.3 | 6.0.3 |
| Vitest | 3.2.7 | 5.0.5 |

Die npm-Tabelle beschreibt aufgelöste Versionen im alten bzw. neuen Lockfile.
Auch Node-/React-Typen, PostCSS, Autoprefixer und transitive Dependencies werden
aktualisiert. `npm ci` ersetzt `npm install` in Maven und Docker, damit alle
Buildpfade dasselbe eingecheckte Lockfile verwenden.

## Breaking Changes und Anpassungen

- **Next.js 15/16:** Route-Parameter werden asynchron geliefert. Die Client-Seite
  `/instances/[id]` liest die ID jetzt mit `useParams()` statt synchron aus
  `params.id`. Die übrigen Seiten verwenden keine synchronen Server-Request-APIs.
  `tsconfig.json` verwendet den von Next 16 vorausgesetzten automatischen
  JSX-Runtime-Modus `react-jsx` und berücksichtigt die generierten Dev-Typen.
- **Next.js 16:** `next lint` entfällt, und `next build` führt kein Linting mehr
  aus. `npm run lint` ruft deshalb direkt ESLint auf. Die Konfiguration wurde von
  `.eslintrc.json` auf `eslint.config.mjs` mit der Next-Core-Web-Vitals-Konfiguration
  migriert. CI prüft Lint und Produktionsbuild getrennt. Interne Navigationslinks
  verwenden `next/link`. Die neue Performance-Regel `set-state-in-effect` bleibt
  als Warnung aktiv: vorhandene Formularsynchronisation und Initialisierung
  werden in dieser Dependency-Migration nicht grundlegend umgebaut. Die übrigen
  Fehlerregeln bleiben aktiv.
- **Next.js 16:** Turbopack ist der Standard-Bundler. Das Projekt hat keine eigene
  Webpack-Konfiguration. Der Standalone-Output und die Backend-Rewrites bleiben
  Bestandteil des Builds. Die neuen Next-Typen werden vom Build erzeugt.
- **Browser:** Next.js 16 setzt Chrome/Edge/Firefox 111+ und Safari 16.4+ voraus.
- **React 19:** React, React DOM und beide Typenpakete werden gemeinsam aktualisiert.
  Das Projekt verwendet weder entfernte Legacy-Render-APIs noch React-internen
  Zugriff auf Element-Refs.
- **Vitest 5:** benötigt mindestens Node 22.12 bzw. 24; daher die einheitliche
  Node-24-LTS-Laufzeit. Die vorhandene Node-Testumgebung bleibt erhalten.
- **date-fns 4:** Typdefinitionen und Modulformat wurden geändert; die verwendeten
  benannten Imports und die deutsche Locale werden über Typecheck und Build geprüft.
- **Spring Boot 3.3–3.5 / Flyway 10+:** PostgreSQL-Unterstützung liegt in einem
  separaten Modul. `flyway-database-postgresql` wurde ergänzt, seine Version folgt
  wie `flyway-core` der Boot-BOM. Bestehende SQL-Migrationen werden nicht verändert.
- **Spring Boot 3.5:** aktualisiert unter anderem Spring Framework, Spring Security,
  Hibernate und Apache HttpClient gemeinsam über die BOM. Eigene öffentliche
  Interfaces, DTOs, Feature-Keys und Datenbankschemata werden nicht geändert.
- **JJWT 0.12.4+:** lehnt doppelte JSON-Feldnamen in Tokens standardmäßig ab.
  Regulär von Controla ausgestellte Tokens enthalten keine doppelten Claims.
  Signieren, Tenant-Claims, Signaturprüfung und Ablauf werden separat getestet.
- **Frontend Maven Plugin 2:** angehobene Mindestanforderungen; Java 17 und Maven
  3.9 erfüllen diese. Java-Zielversion des Community-Backends bleibt 17.

## Bewusst beibehaltene Versionslinien

- **Spring Boot 3.5 statt 4:** Boot 4 bringt unter anderem Spring Framework 7,
  Security 7, Jackson 3 und eine neu organisierte Modulstruktur. Da Premium das
  Community-Backend als Bibliothek konsumiert, braucht dieser Sprung eine
  gemeinsame Migration beider Repositories. Premium muss beim späteren Bezug
  dieser CE-Version auch die Boot-3.5-BOM und Flyway-Module konsistent übernehmen;
  sein eigenes Dependency Management kann sonst die CE-Versionen überschreiben.
- **ESLint 9 statt 10:** `eslint-plugin-react` unterstützt derzeit ESLint bis 9.
- **TypeScript 6.0 statt 7:** die von Next verwendete typescript-eslint-Toolchain
  akzeptiert TypeScript `<6.1`; TypeScript 7 liegt außerhalb dieses Peer-Vertrags.
- **Tailwind 3.4.19 statt 4:** v4 ändert unter anderem Preflight, Utility-Skalen,
  Konfiguration, PostCSS-Anbindung und Browseranforderungen. Eine Migration würde
  einen eigenen visuellen Abgleich aller Seiten erfordern. Das vorhandene
  Klassen-Styling und der klassenbasierte Dark Mode bleiben auf der letzten 3.x-Linie.
- **PostgreSQL 16:** kein automatischer Major-Sprung für persistente Volumes;
  ein solcher Wechsel benötigt ein geplantes Datenbank-Upgrade.

## Validierung

Lokal wurden Maven 3.9.16 und Java 21 mit Java-17-Bytecode-Ziel verwendet;
der Maven-Frontend-Build installiert Node 24.22.0 und npm 11.9.0 selbst.
Die CI behält Java 17 bei. Ein vollständiges Docker-Image wurde nicht gebaut.

Der vollständige Maven-Reactor-Build (`mvn -B verify`) ist erfolgreich.
61 Backend-Tests (inklusive drei neuen JWT-Regressionstests) und 14 Frontend-Tests
bestehen. Typecheck und Next-Produktionsbuild bestehen ebenfalls. ESLint meldet
keine Fehler und elf Warnungen (zehn Hinweise zu State-Updates in Effects sowie
die bestehende Session-Weiterleitung im API-Client).

Die reproduzierbaren Projektprüfungen sind:

```sh
mvn -B -pl backend -am clean verify
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

Zusätzlich wurde das gepackte Backend gegen eine frische PostgreSQL-16-Datenbank
(16.15) gestartet: alle acht bestehenden Flyway-Migrationen wurden angewendet und
Hibernate hat das Schema mit `ddl-auto=validate` validiert. Ein Chromium-Smoke-Test
gegen den Next-Standalone-Server prüft Login, JWT-Session, API-Rewrite,
Instanz-Anlegen/Lesen, `/instances/[id]`, Navigation, Dark-Mode-Persistenz und den
Passwort-Reset ohne Token. Dabei traten keine Browser-Laufzeitfehler auf. Die
n8n-Gegenstelle wurde lokal simuliert; externer Mailversand und die separate
Premium-Edition sind nicht Teil dieser Validierung.

### Verbleibende npm-Audit-Befunde

`npm audit --omit=dev`: **0 Schwachstellen**. Im vollständigen Audit bleiben
**9 betroffene Entwicklungsabhängigkeiten (7 high, 2 moderate)**:

- `braces@3.0.3`: rekursive Glob-Muster können den Stack erschöpfen
  ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)).
  Betrifft auch abhängige Pakete wie Tailwind 3, Chokidar, Micromatch,
  Fast-glob und die aktuelle Next-ESLint-Konfiguration. Es gibt derzeit keine
  gepatchte veröffentlichte Braces-Version.
- `postcss-selector-parser@6.1.5`: quadratische Laufzeit beim Parsen flacher
  Selektoren ([GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)).
  Betrifft auch `postcss-nested`. Die gepatchte 7.x-Linie liegt außerhalb der
  von Tailwind 3 und PostCSS Nested 6 akzeptierten Versionsbereiche.

Die verfügbaren kompatiblen Patches (unter anderem `brace-expansion@1.1.21` und
`picomatch@2.3.2`) sind eingespielt. Keine erzwungenen Major-Overrides oder
Audit-Ausnahmen wurden hinzugefügt. Der verbleibende Glob-Befund kann auch mit
Tailwind 4 nicht vollständig entfallen, solange die aktuelle Next-Lint-Toolchain
weiterhin die betroffene Abhängigkeitskette nutzt. Build und Lint sollten nur
mit vertrauenswürdigen Projektdateien und Konfigurationen ausgeführt werden.

## Referenzen

- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [Spring Boot Upgrade Guide](https://docs.spring.io/spring-boot/3.5/upgrading.html)
- [JJWT Changelog](https://github.com/jwtk/jjwt/blob/0.13.0/CHANGELOG.md)
- [Frontend Maven Plugin Changelog](https://github.com/eirslett/frontend-maven-plugin/blob/master/CHANGELOG.md)
- [Tailwind CSS Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)
