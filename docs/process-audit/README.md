# Öffentlicher Harness Process Audit

Dieses Verzeichnis enthält die automatisch erzeugte, chronologische Prozesshistorie des pi-spec-harness für `munichdeveloper/controla`.

Da das Repository öffentlich ist, dürfen Audit-Ereignisse ausschließlich technische und bereits öffentliche Metadaten enthalten, zum Beispiel Prozesskennung, technischer Akteur, Zugriffsrolle, Issue-, Pull-Request-, Commit- und Workflow-Kennung, Begründung sowie Ergebnis.

Nicht zulässig sind Secrets, Tokens, Zugangsdaten, Inhalte lokaler `.env`-Dateien, personenbezogene Daten, private URLs und echte Produktionsdaten. Tests und Beispiele verwenden ausschließlich synthetische Daten.

Auditdateien werden vom auf einen unveränderlichen Release-Commit gepinnten Harness-Receiver validiert und idempotent unter `docs/process-audit/journal/` geschrieben. Manuelle Änderungen an automatisch erzeugten Journaldateien sind nicht vorgesehen.
