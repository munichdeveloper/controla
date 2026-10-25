# Frontend - Quick Setup

Voraussetzung: Node.js 24 LTS und npm 11 (`nvm use` liest `.nvmrc`).
Details zu Versionssprüngen: [Dependency-Update](../docs/DEPENDENCY_UPGRADE.md).

## 🚀 Schnellstart

```powershell
# 1. Dependencies installieren
npm ci

# 2. Dev-Server starten
npm run dev
```

Frontend läuft auf: **http://localhost:3001**

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

- **Frontend:** http://localhost:3001
- **Backend:** http://localhost:8081
- **Backend Health:** http://localhost:8081/actuator/health

