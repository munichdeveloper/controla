# Frontend - Quick Setup

## 🚀 Schnellstart

```powershell
# 1. Dependencies installieren
npm ci

# 2. Dev-Server starten
npm run dev
```

Frontend läuft auf: **http://localhost:3000**

## Build und Prüfungen

Mit Node.js 20 und dem eingecheckten Lockfile prüfen:

```sh
npm ci
npm run lint
npm test
npm run build
npm run typecheck
```

Der Build läuft vor dem expliziten Typecheck, damit Next.js 14 auch bei einem
frischen Checkout die in `tsconfig.json` referenzierten Routentypen erzeugt.
`npm ci` wird auch im Maven- und Docker-Build verwendet und ändert das Lockfile
nicht. Für den vollständigen Build vom Repository-Root `mvn -B clean verify`
mit Java 17 ausführen. Die PostgreSQL-Tests benötigen einen laufenden Docker-Daemon;
JaCoCo erzeugt den Coverage-Bericht unter `backend/target/site/jacoco`.

## ⚙️ Lokale Konfiguration

### Backend läuft auf Port 8081?

Die `.env.local` Datei ist bereits konfiguriert für Port **8081**:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8081
BACKEND_URL=http://localhost:8081/api
```

✅ **Kein weiterer Schritt nötig!**

### Backend läuft auf Port 8080?

Bearbeite `.env.local` und ändere auf Port 8080:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
BACKEND_URL=http://localhost:8080/api
```

**Oder lösche `.env.local`** (dann wird `.env` mit Port 8080 verwendet)

## 🔄 Nach Änderungen

Nach dem Ändern der `.env.local`:

```powershell
# Stoppe Dev-Server (Strg+C)
# Starte neu
npm run dev
```

## 📚 Mehr Infos

Siehe [ENV_CONFIG.md](ENV_CONFIG.md) für:
- Detaillierte Konfiguration
- Troubleshooting
- Verschiedene Umgebungen
- API-Testing

## ✅ Checklist

- [x] `.env.local` vorhanden (Port 8081)
- [x] `.env` als Template
- [x] `.gitignore` aktualisiert
- [ ] `npm ci` ausgeführt
- [ ] Backend läuft auf Port 8081
- [ ] Frontend startet mit `npm run dev`

## 🔗 Links

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8081
- **Backend Health:** http://localhost:8081/actuator/health

