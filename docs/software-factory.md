# Software Factory betreiben

Software Factory (SF) bearbeitet ausdrücklich aufgenommene Community-Aufgaben und
liefert prüfbare Pull Requests. Maßgeblich sind die
[Konfiguration](../.github/software-factory.yml), der
[Executor-Workflow](../.github/workflows/factory-manager.yml) und
[AGENTS.md](../AGENTS.md). Diese Anleitung beschreibt den installierten Stand;
bei Abweichungen gilt die Konfiguration.

## Issue aufnehmen und freigeben

Nur Issues mit dem Label `harness:managed` gehören zur SF. Die früheren
pi-spec-harness-/Squad-Workflows sind stillgelegt; ihre historischen Issues
bilden keine automatische Warteschlange.

Ein Issue braucht ein abgegrenztes Ziel und einen konkreten Abschnitt
`Acceptance criteria`, zum Beispiel:

```markdown
## Ziel
Eine deutsche Betriebsanleitung für die installierte Software Factory ergänzen.

## Acceptance criteria

- Ausschließlich docs/software-factory.md ändern.
- Issue-Opt-in, Freigabe und die konfigurierten Modelle erklären.
- Ressourcenlimits, Kill Switch und Community/Premium-Grenze dokumentieren.
```

Ablauf:

1. Issue anlegen und das Label `harness:managed` setzen. Die SF übernimmt es in
   den Status `backlog`.
2. Eine berechtigte Person erteilt die Freigabe mit dem Label `harness:ready`.
   Der Lauf startet beim nächsten Abgleich des SF Managers.
3. Den aktuellen Stand zeigt ein vom SF Manager gepflegter Statuskommentar im
   Issue („Software Factory · …“, mit „Needed from you“). Ihn zu bearbeiten
   ändert nichts.

Weitere Status-Labels: `harness:blocked` (Abhängigkeit offen oder Worker hat
abgebrochen), `harness:failed` (Lauf fehlgeschlagen; eine Wiederholung braucht
erneut `harness:ready`), `harness:awaiting-pr` (PR liegt vor) sowie
`harness:priority-low|normal|high`. Abhängigkeiten stehen als Zeile
`Depends on: #123` im Issue-Text; ein Folge-Task verweist mit `Origin: #123`
auf sein Ursprungs-Issue.

Die Steuerung läuft über den SF Manager (GitHub App
`munichdeveloper-sf-manager-local`) mit der Engine Temporal
(`execution.engine: temporal`). Der Workflow
[factory-manager.yml](../.github/workflows/factory-manager.yml) ist nur der
Executor, den der Manager per `workflow_dispatch` für einen einzelnen Lauf
startet; er wird nicht von Hand gestartet. Konfigurationsänderungen an der SF
kommen als PR „SF Manager: update Factory configuration“.

## Planung, Umsetzung und Zugang

| Aufgabe | Installierte Einstellung |
| --- | --- |
| SF-Planung | `llm.provider: openai`, Modell `gpt-4.1-mini` |
| Code-Umsetzung | `workers.coding.agent: codex`, Modell `gpt-6.1-sol`, `reasoningEffort: high` |
| Review vor dem Merge | `merge.review.model: gpt-6.1-sol`, `reasoningEffort: high` |

Das Planungsmodell entscheidet über Statuswechsel, Prioritäten und
Worker-Starts; der Codex Harness führt den Coding-Agenten aus. Test-Worker und
separater Review-Worker (`workers.review`) sind deaktiviert.

Die OpenAI-Zugriffe des Executors verwenden das Actions-Secret
`OPENAI_API_KEY` (GitHub → **Settings → Secrets and variables → Actions**).
Zugangsdaten gehören niemals in Issues, Quelldateien oder Prompts.

## Autonomie und Grenzen

`autonomy.profile: autonomous` erlaubt Statuswechsel, Priorisierung,
Aufgabenfreigabe, Worker-Start, Wiederholung, Abbruch, das Schließen von Issues,
Folge-Issues und das Mergen von PRs (siehe unten). Scope-Erweiterungen sind
gesperrt (`expand_scope: deny`).

| Grenze | Konfigurierter Wert |
| --- | --- |
| Gleichzeitige Worker (`maxParallelWorkers`) | 1 |
| Wiederholungen (`maxRetries`) | 2 |
| Neue Issues pro Lauf (`maxNewIssues`) | 3 |
| Manager-Aktionen pro Lauf (`maxActions`) | 10 |
| Manager-Zeitbudget (`timeoutMinutes`) | 15 Minuten |
| Worker-Zeitbudget (`workerTimeoutMinutes`) | 30 Minuten |
| Dispatch-Wartefrist (`dispatchGraceMinutes`) | 10 Minuten |
| Planung (`llm`) | 1 Aufruf, 60 Sekunden Timeout, maximal 4000 Ausgabe-Tokens |

Weil nur ein Worker gleichzeitig läuft, blockieren doppelte Issues zur selben
Aufgabe einander. Duplikate daher schließen und nur ein Issue weiterführen.

## Merge

Der Abschnitt `merge` ist aktiviert. Er erfasst Factory-PRs
(`includeFactoryPRs: true`) und PRs, die ausdrücklich das Label `sf:automerge`
tragen. Vor dem Merge aktualisiert die SF den Branch (`updateBranch: true`),
verlangt grüne Pflicht-Checks `test-backend`, `test-frontend` und `test-docker`
aus [test.yml](../.github/workflows/test.yml) und eine unabhängige KI-Review.
Gemergt wird per Squash, höchstens ein Merge pro Lauf. Danach läuft
`docker-publish.yml`. Native Branch-Regeln von GitHub gelten weiterhin.
Ein Deployment führt die SF nicht aus (`deploy.enabled: false`).

## Benachrichtigungen

Neue Issues und Merges durch die SF meldet sie im Slack-Kanal
`#ki-notification` (`notifications.slack`). Entscheidungen werden zusätzlich
als Kommentare im Issue protokolliert (`reporting.persistDecisions: true`).

## Abschalten und Versionsbindung

Der globale Kill Switch ist `factory.enabled: false` in
[.github/software-factory.yml](../.github/software-factory.yml). Laufende
Actions-Ausführungen bei Bedarf zusätzlich in GitHub Actions abbrechen.

Der Executor bindet unveränderliche Commits von
[software-factory](https://github.com/munichdeveloper/software-factory)
(`factory-ref`) und
[dev-agent-harness](https://github.com/munichdeveloper/dev-agent-harness)
(`harness-ref`). Die aktuellen Werte stehen in
[factory-manager.yml](../.github/workflows/factory-manager.yml).

## Community/Premium-Grenze

Auch autonome Aufgaben beachten [AGENTS.md](../AGENTS.md): In dieses Repository
gehören Community-Grundfunktionen, abwärtskompatible Erweiterungspunkte und das
gemeinsame Frontend. Paid-/Enterprise-Implementierungen gehören in das private
Premium-Backend. Neue UI-Bedienelemente werden über einen eigenen Feature-Key nur
angezeigt, wenn das angeschlossene Backend den Endpunkt garantiert anbietet;
fehlende Keys gelten als deaktiviert. Öffentliche CE-APIs bleiben kompatibel,
Premium erhält CE-Änderungen erst über Release und Versions-Bump.
