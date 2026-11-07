# Software Factory betreiben

Software Factory (SF) bearbeitet ausdrücklich aufgenommene Community-Aufgaben und
liefert prüfbare Pull Requests. Maßgeblich sind die
[Konfiguration](../.github/software-factory.yml), der
[Manager-Workflow](../.github/workflows/factory-manager.yml) und
[AGENTS.md](../AGENTS.md).

## Issue aufnehmen und Manager starten

Nur Issues mit dem Label `harness:managed` gehören zur SF. Dieses Label ist das
persistierte Kompatibilitätsvokabular der SF. Die früheren
pi-spec-harness-/Squad-Workflows sind stillgelegt; ihre historischen Issues und
Dateien bilden keine automatische Warteschlange.

Ein Issue braucht ein abgegrenztes Ziel und einen konkreten Abschnitt
`Acceptance criteria`, zum Beispiel:

```markdown
## Ziel
Eine deutsche Betriebsanleitung für die installierte Software Factory ergänzen.

## Acceptance criteria

- Ausschließlich docs/software-factory.md ändern.
- Issue-Opt-in, Manager-Aufruf und die konfigurierten Modelle erklären.
- Ressourcenlimits, Kill Switch und Community/Premium-Grenze dokumentieren.
- Inhalt mit der installierten Konfiguration abgleichen und Whitespace prüfen.
```

Nach dieser Vorbereitung das Issue ausdrücklich aufnehmen, etwa mit
`gh issue edit 123 --repo munichdeveloper/controla --add-label harness:managed`
(`123` durch die gewünschte Issue-Nummer ersetzen).
Der Manager läuft alle zwei Stunden zur Minute 17 (UTC). Manuell starten:

```sh
gh workflow run factory-manager.yml --repo munichdeveloper/controla -f mode=manager -F dry_run=false
```

Für einen Probelauf `-F dry_run=true` verwenden. Läufe und Entscheidungen lassen
sich im Actions-Workflow „Software Factory“ verfolgen; die Konfiguration aktiviert
das Persistieren der Entscheidungen (`reporting.persistDecisions: true`).

## Planung, Umsetzung und Zugang

| Aufgabe | Installierte Einstellung |
| --- | --- |
| SF-Planung | `llm.provider: openai`, Modell `gpt-4.1-mini`, `reasoningEffort: null` |
| Tatsächliche Code-Umsetzung | `workers.coding.agent: codex`, Modell `gpt-6.1-sol`, `reasoningEffort: high` |
| Produktvalidierung | `workers.coding.validationWorkflow: test.yml` |

Das Planungsmodell entscheidet über Aufgaben und Aktionen; der unabhängige Codex
Harness führt den Coding-Agenten aus. Der synthetische Test-Worker und der separate
Review-Worker sind deaktiviert.

Beide OpenAI-Zugriffe verwenden das Actions-Secret `OPENAI_API_KEY`. Es wird im
GitHub-Repository unter **Settings → Secrets and variables → Actions** als
Repository-Secret hinterlegt und vom Workflow an Planung und Coding weitergegeben.
Zugangsdaten gehören niemals in Issues, Quelldateien oder Prompts.

## Autonomie, Grenzen und PR-Ausgabe

`autonomy.profile: autonomous` erlaubt Statuswechsel, Priorisierung, Aufgabenfreigabe,
Worker-Start, Wiederholung und Abbruch sowie das Schließen von Issues, Folge-Issues
und Scope-Erweiterungen. Diese Policy bleibt an den konfigurierten Auftrag und die
Ressourcenbudgets gebunden:

| Grenze | Konfigurierter Wert |
| --- | --- |
| Gleichzeitige Worker (`maxParallelWorkers`) | 1 |
| Wiederholungen (`maxRetries`) | 2 |
| Neue Issues (`maxNewIssues`) | 3 |
| Manager-Aktionen pro Lauf (`maxActions`) | 10 |
| Manager-Zeitbudget / äußerer Actions-Job | 15 / 20 Minuten |
| Worker-Zeitbudget (`workerTimeoutMinutes`) | 30 Minuten |
| Dispatch-Wartefrist (`dispatchGraceMinutes`) | 10 Minuten |
| Planung (`llm`) | 1 Aufruf, 60 Sekunden Timeout, maximal 4000 Ausgabe-Tokens |

Manager-Läufe sind über eine gemeinsame Concurrency-Gruppe serialisiert;
`cancel-in-progress: false` verhindert das automatische Abbrechen laufender Jobs.
Worker haben eine eigene Gruppe je Ausführung und zusätzlich das obige Parallelitätslimit.

Der eingebundene Coding-Workflow trennt **prepare**, **code** und **publish**:
Prepare bereitet den autorisierten Auftrag vor. Code bearbeitet und testet den
Checkout mit lesenden GitHub-Berechtigungen. Publish prüft die Autorisierung erneut
und veröffentlicht die Änderungen in einem separaten Job als prüfbaren PR.
Der Coding-Agent selbst publiziert keine Änderungen.

Die explizite Produkt-CI ist [test.yml](../.github/workflows/test.yml): Backend-Build
und Tests mit Maven, Frontend-Lint/Tests/Build/Typprüfung sowie Docker-Build und
Smoke-Test. Ihre Ergebnisse und die Repository-Branchregeln bleiben maßgeblich.
Automatisches PR-Merging ist nicht implementiert und mit `merge_pr: deny` gesperrt;
ein PR bleibt zur Prüfung und zum regulären Merge stehen. Coding-Änderungen an
Workflow- oder Agentenkonfiguration sind ebenfalls nicht unterstützt.

## Abschalten und Versionsbindung

Der globale Kill Switch ist `factory.enabled: false` in
[.github/software-factory.yml](../.github/software-factory.yml). Damit wird die
Factory deaktiviert. Bereits laufende Actions-Ausführungen bei Bedarf zusätzlich
in GitHub Actions abbrechen.

Der Workflow bindet unveränderliche Commits ein:

- [Software Factory v0.2.2](https://github.com/munichdeveloper/software-factory/releases/tag/v0.2.2):
  `5b9e785bcb396c51f717476273bf5f37a9cc46e7`.
- [Codex Harness v0.3.2](https://github.com/munichdeveloper/dev-agent-harness/releases/tag/v0.3.2):
  `8f1732c05c351af32bd25a6306a92f3bb06c1bad`.

## Community/Premium-Grenze

Auch autonome Aufgaben beachten [AGENTS.md](../AGENTS.md): In dieses Repository
gehören Community-Grundfunktionen, abwärtskompatible Erweiterungspunkte und das
gemeinsame Frontend. Paid-/Enterprise-Implementierungen gehören in das private
Premium-Backend. Neue UI-Bedienelemente werden über einen eigenen Feature-Key nur
angezeigt, wenn das angeschlossene Backend den Endpunkt garantiert anbietet;
fehlende Keys gelten als deaktiviert. Öffentliche CE-APIs bleiben kompatibel,
Premium erhält CE-Änderungen erst über Release und Versions-Bump.
