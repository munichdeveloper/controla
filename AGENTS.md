<!-- BEGIN pi-spec-harness managed context v1 -->
## Harness-Kontext (verwaltet von pi-spec-harness)

Dieses Repository (munichdeveloper/controla) wird teilweise von [pi-spec-harness](https://github.com/munichdeveloper/pi-spec-harness)
orchestriert. Der Harness ändert keinen Produktcode selbst; er
kontrolliert und beobachtet, wie ein Agent zwischen Spec, Issue, PR und
Merge bewegt wird.

**Bevor du an einem Issue eigenständig arbeitest:** Prüfe zuerst, ob
bereits ein offenes Tracking-Issue (Titel `[Harness Run] <run-id>`,
Label `harness:run`) existiert, das auf dieses Issue verweist. Falls
ja, enthält dessen Body den kanonischen, aktuellen Fortschrittsstand
(Phase, offene Gates, bisherige Entscheidungen) — lies ihn, bevor du
von vorne beginnst oder rätst, was bereits erledigt ist.

**Label-Vokabular:**

| Label | Bedeutung |
|---|---|
| `ai:allowed` | Issue darf von einem Agenten selbstständig bearbeitet werden |
| `status:ready` | Issue ist fachlich/technisch bereit zur Bearbeitung |
| `status:needs-human` | Ein Mensch muss entscheiden, bevor es weitergeht |
| `harness:run` | Markiert das persistente Tracking-Issue eines Runs |
| `harness:implementation` | Markiert ein vom Harness erzeugtes Implementierungs-Issue |
| `harness:gate-approved` / `harness:gate-rejected` | Menschliche Entscheidung auf einem offenen Gate |

Ausführliche Dokumentation zum Protokoll: `docs/human-gates.md` und
`docs/event-driven-workflow.md` im Harness-Repository.

Dieser Block wird von `harness init --install-agents-context`
verwaltet. Änderungen innerhalb der Marker werden bei der nächsten
Installation überschrieben; projektspezifische Regeln gehören
außerhalb dieses Blocks.
<!-- END pi-spec-harness managed context v1 -->
