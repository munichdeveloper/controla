# Companion Feature - Frontend Implementation

## Überblick

Das Companion-Feature ermöglicht es Premium-Nutzern, n8n-Instanzen mithilfe des n8n Companion Docker Containers zu verwalten, zu updaten und zu überwachen.

## Komponenten

### 1. **CompanionSettingsPanel** (`CompanionSettingsPanel.tsx`)
Formular zur Konfiguration des Companion:
- Host-Adresse eingeben
- Port einstellen
- API-Key verwalten (maskiert mit Anzeige/Verbergen-Knopf)
- Speichern und Löschen der Konfiguration

### 2. **CompanionStatusCard & Indicator** (`CompanionStatusCard.tsx`)
Status-Anzeige mit zwei Varianten:
- **StatusCard**: Komplette Status-Information (Container-Status, Verbindung, Versionen)
- **IndicatorDot**: Kleiner Status-Punkt im Header (grün = verbunden, rot = nicht erreichbar)

### 3. **UpdateProgressOverlay** (`UpdateProgressOverlay.tsx`)
UI-Overlay, das beim Update angezeigt wird:
- Sperrt den gesamten Companion-Bereich
- Zeigt aktuelle Update-Phase (PULLING, RESTARTING, VERIFYING)
- Verschwindet automatisch wenn Update fertig

### 4. **UpdateActionPanel** (`UpdateActionPanel.tsx`)
Update-Verwaltung mit drei Modi:
1. **Auto-Update Toggle**: Automatische Updates auf neueste Version
2. **Sofortiges Update**: Manuelle Auslösung mit optionaler Versionswahl
3. **Geplantes Update**: Date-Time-Picker für spätere Updates

### 5. **ManagementActionBar** (`ManagementActionBar.tsx`)
Docker-Container-Verwaltung:
- Stop/Start/Pull-Buttons
- Version pinnen (ohne Neustart)
- Anzeige von Docker-Befehls-Output

### 6. **UpdateHistoryTable** (`UpdateHistoryTable.tsx`)
Verlauf aller durchgeführten Updates:
- Datum, von/nach Version
- Status (SUCCESS/FAILED/IN_PROGRESS)
- Auslösetyp (AUTO/MANUAL/SCHEDULED)
- Erweiterbare Fehlermeldungen

### 7. **useCompanionStatusPoller** (`useCompanionStatusPoller.ts`)
Custom Hook für Auto-Polling:
- Lädt Status alle 3 Sekunden wenn Update läuft
- Stoppt automatisch wenn Update fertig
- Zentrale Staging für alle Status-Updates

### 8. **CompanionSection & CompanionIndicator** (`index.tsx`)
Zentrale Export-Komponenten:
- **CompanionSection**: Wirkt als Wrapper mit Premium-Guard
- **CompanionIndicator**: Weiterleitung an StatusCard Indicator

## API-Funktionen

Alle API-Calls sind in `lib/api/index.ts` implementiert:

```typescript
// Configuration
getCompanionConfig(externalId)
updateCompanionConfig(externalId, config)
deleteCompanionConfig(externalId)

// Status & Versions
getCompanionStatus(externalId)
getCompanionVersions(externalId)

// Update Management
getCompanionUpdateSettings(externalId)
updateCompanionUpdateSettings(externalId, settings)
startCompanionUpdate(externalId, targetVersion?)
scheduleCompanionUpdate(externalId, scheduledAt)
cancelScheduledUpdate(externalId)
getCompanionUpdateHistory(externalId, page?, size?)

// Container Management
startCompanionContainer(externalId)
stopCompanionContainer(externalId)
pullCompanionImage(externalId)
pinCompanionVersion(externalId, version)
```

## Premium-Guard Implementation

**Wichtig:** Alle Companion-Features sind Premium-only!

2 Möglichkeiten um Premium zu prüfen:
1. Im Komponenten-JSX: `useLicense()` Hook verwenden
2. In der CompanionSection: Bereits eingebaut

```typescript
// Beispiel aus CompanionSection
const { isPremium, loading } = useLicense();

if (licenseLoading) return <div>Lädt…</div>;
if (!isPremium) return null; // Nicht anzeigen für CE-Nutzer

return <div>Companion UI…</div>;
```

## Integration in Instance-Detail-View

- Neuer Tab "Companion" (nur Premium)
- CompanionIndicator im Header neben Instanzname
- Automatisches Polling, wenn Update läuft

## Type-Definitionen

Alle Companion-spezifischen Types sind in `lib/types/index.ts`:

```typescript
CompanionConfig
CompanionStatus
CompanionVersions
CompanionUpdateSettings
CompanionUpdateHistory
CompanionUpdateResponse
```

## Styling & Dark Mode

- Alle Komponenten folgen dem bestehenden Tailwind-Design
- Vollständige Dark-Mode Unterstützung
- Farbschema: Grün für Success, Rot für Error, Blau für Informationen
- Status-Badges mit passenden Farben

## Error Handling

- 404: Config nicht gefunden → Setup-Hinweis
- 409: Update läuft bereits → Freundliche Meldung
- 400: Validierungsfehler → Formular-Feedback
- 500: Server-Fehler → Toast-Benachrichtigung
- Netzwerkfehler → Offline-Status

## Performance

- Polling nur aktiv während Update (3s Interval)
- Automatische Cleanup bei Unmount
- Lazy Loading von History-Tabelle
- Keine redundanten API-Calls

## Implementierungsnotizen

- Alle Datum/Uhrzeiten nutzen `new Date().toLocaleString('de-DE')`
- ISO-Format für Backend-Kommunikation
- LocalStorage wird nicht verwendet (stateless)
- Token wird automatisch aus `localStorage` gelesen

