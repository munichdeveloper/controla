# n8n Instance Manager - Community Edition

Ein Monorepo-Projekt zur Überwachung von bis zu 3 n8n-Instanzen (Community Edition).

## 🏗️ Architektur

- **Backend:** Spring Boot (Java 17) - API-Fassade zu Agency Core
- **Frontend:** Next.js 14 mit TypeScript, Tailwind CSS und TanStack Query
- **Database:** PostgreSQL 16 (Standard) oder H2 (Dev)
- **Authentication:** JWT-basiert mit Spring Security
- **Build-System:** Maven (Monorepo mit Root-POM)
- **Deployment:** Docker Compose
- **Core API:** Agency Core API (Port 8081) mit Swagger/OpenAPI Dokumentation

## 📋 Features

### Community Edition
- ✅ Übersicht über bis zu 3 n8n-Instanzen
- ✅ Status-Monitoring (online/offline)
- ✅ Workflow-Übersicht (read-only)
- ✅ Fehlerübersicht (WORKFLOW_ERROR Events)
- ✅ E-Mail-Alert-Einstellungen
- ✅ Performance-Metriken (Basis)

## 🚀 Schnellstart

### Voraussetzungen
- Java 17+
- Maven 3.9+
- Docker & Docker Compose (für PostgreSQL)
- Node.js 20+ (optional, wird automatisch installiert)

### Option 1: Automatisches Setup (Empfohlen)

```powershell
# Windows PowerShell
.\setup-postgres.ps1
```

Das Script:
1. Startet PostgreSQL in Docker
2. Kompiliert Backend
3. Installiert Frontend Dependencies

Dann manuell starten:
```bash
# Terminal 1: Backend
cd backend
mvn spring-boot:run

# Terminal 2: Frontend
cd frontend
npm run dev
```

**Login:** `admin` / `admin123`  
**URL:** http://localhost:3000

### Option 2: Alles in Docker

```bash
# Alle Services starten (PostgreSQL + Backend + Frontend)
docker-compose up -d

# Logs anschauen
docker-compose logs -f
```

**URL:** http://localhost:3000

### Option 3: Lokale Entwicklung (ohne PostgreSQL)

```bash
# Backend mit H2-Datenbank starten
cd backend
mvn spring-boot:run -Dspring.profiles.active=dev

# Frontend starten
cd frontend
npm install
npm run dev
```

**H2 Console:** http://localhost:8080/h2-console  
**JDBC URL:** `jdbc:h2:file:./data/n8n-manager-dev`

### 4. Frontend starten (Entwicklung)

```bash
cd frontend
npm install
npm run dev
```

Frontend läuft auf: http://localhost:3000

## 🐳 Docker

### Docker Build

```bash
docker build -t n8n-instance-manager .
```

### Docker Run

```bash
docker run -p 8080:8080 -p 3000:3000 \
  -e CORE_BASE_URL=https://core-api.example.com \
  -e CORE_API_TOKEN=your-token \
  n8n-instance-manager
```

## 📁 Projektstruktur

```
n8n-instance-manager/
├── backend/                    # Spring Boot Backend
│   ├── src/main/java/
│   │   └── de/dgtlschmd/n8n/
│   │       ├── alerts/         # Alert Settings
│   │       ├── config/         # Configuration
│   │       ├── dto/            # Data Transfer Objects
│   │       ├── instance/       # Instance Domain
│   │       └── service/        # CoreApiClient
│   └── pom.xml
├── frontend/                   # Next.js Frontend
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   │   ├── instances/[id]/ # Instanz-Detail
│   │   │   └── settings/alerts/ # Alert-Einstellungen
│   │   └── lib/
│   │       ├── api/           # API Client
│   │       ├── types/         # TypeScript Types
│   │       └── utils/         # Utility Functions
│   └── pom.xml
├── Dockerfile                 # Multi-Stage Docker Build
└── pom.xml                    # Root POM (Monorepo)
```

## 🔌 API-Endpunkte

### Authentication
- `POST /api/auth/login` - Login (JWT Token)
- `POST /api/auth/register` - Registrierung
- `GET /api/auth/me` - Aktueller User

### Instanzen (🔒 Authentifizierung erforderlich)
- `GET /api/instances` - Liste aller Instanzen
- `POST /api/instances` - Neue Instanz erstellen (max. 3)
- `GET /api/instances/{id}` - Instanz-Details
- `GET /api/instances/{id}/workflows` - Workflows einer Instanz
- `GET /api/instances/{id}/events` - Events/Fehler einer Instanz
- `GET /api/instances/{id}/metrics` - Metriken einer Instanz

### Alert Settings (🔒 Authentifizierung erforderlich)
- `GET /api/alerts/settings` - Alert-Einstellungen abrufen
- `PUT /api/alerts/settings` - Alert-Einstellungen speichern
- `PUT /api/alerts/settings` - Alert-Einstellungen aktualisieren

### Health
- `GET /actuator/health` - Backend Health Check

## 💾 Datenbank

### PostgreSQL (Standard - Produktion)

```bash
# Nur PostgreSQL starten
docker-compose -f docker-compose.postgres.yml up -d

# Verbinden mit psql
docker exec -it n8n-manager-postgres psql -U n8n_user -d n8n_manager

# Backup erstellen
docker exec n8n-manager-postgres pg_dump -U n8n_user n8n_manager > backup.sql

# Backup wiederherstellen
docker exec -i n8n-manager-postgres psql -U n8n_user -d n8n_manager < backup.sql
```

**Credentials:**
- Host: `localhost:5432`
- Database: `n8n_manager`
- User: `n8n_user`
- Password: `n8n_secure_password`

### H2 (Dev - Lokale Entwicklung)

```bash
# Backend mit Dev-Profil starten
mvn spring-boot:run -Dspring.profiles.active=dev
```

**H2 Console:** http://localhost:8080/h2-console  
**JDBC URL:** `jdbc:h2:file:./data/n8n-manager-dev`  
**User:** `sa` / **Password:** `password`

Daten werden in `./data/` gespeichert und bleiben erhalten.

📖 **Detaillierte PostgreSQL-Dokumentation:** [docs/POSTGRESQL_SETUP.md](docs/POSTGRESQL_SETUP.md)

## 🛠️ Entwicklung

### Backend
```bash
cd backend
mvn spring-boot:run
```

### Frontend
```bash
cd frontend
npm run dev
```

### Tests ausführen
```bash
mvn test
```

## 🎨 Frontend-Technologien

- **Next.js 14** - React Framework mit App Router
- **TypeScript** - Type Safety
- **Tailwind CSS** - Utility-First CSS
- **TanStack Query** - Server State Management
- **date-fns** - Datum-Formatierung

## 📦 Maven Build

Das Projekt nutzt ein Maven Monorepo:

```bash
# Alles bauen
mvn clean package

# Backend JAR: backend/target/backend-1.0.0-SNAPSHOT.jar
# Frontend Build: frontend/.next/
```

## 🔐 Umgebungsvariablen

### Backend
- `CORE_BASE_URL` - URL der Agency Core API (Standard: http://localhost:8081)
- `CORE_API_TOKEN` - API Key für Core (Standard: dev-apikey-123)
- `CORE_TENANT_ID` - Tenant-ID für Multi-Tenancy (Standard: 123e4567-e89b-12d3-a456-426614174000)
- `SERVER_PORT` - Port des Backends (Standard: 8080)

### Frontend
- `NEXT_PUBLIC_BACKEND_BASE_URL` - Backend URL (Standard: /api via Proxy)

## 📈 Erweiterbarkeit

Das Projekt ist so konzipiert, dass es einfach zur Pro-Version erweitert werden kann:

- ✨ Mehr als 3 Instanzen
- ✨ Team-Features
- ✨ Erweiterte Analytics
- ✨ Credentials-Monitoring
- ✨ Slack/Telegram Alerts
- ✨ Custom Dashboards

## 📚 Dokumentation

Weitere Dokumentation finden Sie im [`docs/`](./docs) Ordner:

- **[Quick Start Guide](./docs/QUICKSTART.md)** - Schnellstart in 3 Schritten
- **[Agency Core Integration](./docs/AGENCY_CORE_INTEGRATION.md)** - Integration mit Agency Core API
- **[Setup Complete](./docs/SETUP_COMPLETE.md)** - Vollständige Setup-Dokumentation
- **[Build Status](./docs/BUILD_STATUS.md)** - Build-Metriken und Status
- **[Status](./docs/STATUS.md)** - Original Projekt-Status

## 📝 Lizenz

Dieses Projekt ist Teil des n8n Instance Manager Systems.

## 🤝 Support

Für Fragen und Support kontaktieren Sie das Entwicklungsteam.

