# Controla Documentation

Willkommen zur Controla-Dokumentation!

## 📚 Dokumentationsstruktur

### Schnellstart
- [README.md](../README.md) - Hauptdokumentation, Schnellstart, Features

### Deployment
- [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) - Detaillierte Docker-Anleitung mit Troubleshooting

### Architektur
- [system.yaml](../doc-meta/system.yaml) - System-Architektur und Komponenten
- [glossary.yaml](../doc-meta/glossary.yaml) - Begriffsdefinitionen

### Entscheidungen
- [04_decisions/README.md](04_decisions/README.md) - Architecture Decision Records (ADRs)
- [ADR-001: Single Container Deployment](04_decisions/ADR-001-single-container-deployment.md)

## 🎯 Für neue Entwickler

1. **Start hier:** [README.md](../README.md)
2. **Verstehe die Architektur:** [system.yaml](../doc-meta/system.yaml)
3. **Docker Deployment:** [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
4. **Begriffe klären:** [glossary.yaml](../doc-meta/glossary.yaml)

## 🔧 Für DevOps

- **Docker Setup:** [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- **Umgebungsvariablen:** Siehe DOCKER_DEPLOYMENT.md → Abschnitt "Umgebungsvariablen"
- **Troubleshooting:** Siehe DOCKER_DEPLOYMENT.md → Abschnitt "Troubleshooting"
- **Production:** Siehe DOCKER_DEPLOYMENT.md → Abschnitt "Produktion"

## 🏗️ Für Architekten

- **System-Design:** [system.yaml](../doc-meta/system.yaml)
- **Deployment-Entscheidung:** [ADR-001](04_decisions/ADR-001-single-container-deployment.md)
- **Netzwerk-Architektur:** DOCKER_DEPLOYMENT.md → "Netzwerk-Kommunikation"

## 🚨 Monitoring & Alerts

- Instanz-Alerts decken Statusübergänge `online -> offline`, `online -> error`, `error -> offline` und Wiederherstellungen `offline/error -> online` ab.
- Der `auth_error`-Pfad bleibt ein separater Alert-Fall für ungültige API-Keys.

## 📝 Dokumentations-Richtlinien

Siehe: [.github/copilot-instructions.md](../.github/copilot-instructions.md)

**Wichtige Regeln:**
- Dokumentation nur in `/docs/**` und `/doc-meta/**`
- Bestehende Docs aktualisieren statt neue zu erstellen
- Glossar-Konsistenz beachten
- ADRs sind immutable (außer Errata-Section)
- Neue Entscheidungen = neue ADR-Datei

## 🔍 Suche

### Ich suche nach...

| Was? | Wo? |
|------|-----|
| Wie starte ich Controla? | [README.md](../README.md) → Schnellstart |
| Docker-Ports und Umgebungsvariablen | [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) |
| Warum läuft alles in einem Container? | [ADR-001](04_decisions/ADR-001-single-container-deployment.md) |
| Was bedeutet NEXT_PUBLIC_BACKEND_BASE_URL? | [glossary.yaml](../doc-meta/glossary.yaml) |
| Auf welchem Port läuft das Backend? | [system.yaml](../doc-meta/system.yaml) |
| Fehlersuche bei Docker | [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) → Troubleshooting |

## 📅 Änderungshistorie

- **2026-04-28:** Versionshinweis im Frontend korrigiert
  - Die Update-Badge für Instanzen erscheint nur noch, wenn `latestVersion` semantisch neuer ist als die installierte `version`
  - Gleich hohe oder höhere installierte Versionen werden als aktuell behandelt

- **2026-04-23:** Alerting für Statusübergänge präzisiert
  - `online -> error` wird als Offline-Alert behandelt
  - `auth_error` bleibt separater Alert-Pfad für ungültige API-Keys

- **2026-01-16:** Initial documentation setup
  - system.yaml erstellt
  - glossary.yaml erstellt
  - ADR-001: Single Container Deployment
  - DOCKER_DEPLOYMENT.md hinzugefügt

