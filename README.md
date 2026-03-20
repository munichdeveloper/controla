# Controla - Community Edition

A monorepo project for monitoring up to 3 n8n instances in the Community Edition.

## License
Controla Community Edition is licensed under the GNU Affero General Public License v3.0 (AGPLv3).
See the LICENSE file for details.

## 🏗️ Architecture

- **Backend:** Spring Boot (Java 17)
- **Frontend:** Next.js 14 with TypeScript, Tailwind CSS and TanStack Query
- **Database:** PostgreSQL 16 (Default) or H2 (Dev)
- **Authentication:** JWT-based with Spring Security
- **Build System:** Maven (Monorepo with Root POM)
- **Deployment:** Docker Compose

## 📋 Features

### Community Edition
- ✅ Overview of up to 3 n8n instances
- ✅ Status monitoring (online/offline)
- ✅ Workflow overview (read-only)
- ✅ Error overview (WORKFLOW_ERROR Events)
- ✅ E-Mail alert settings
- ✅ Performance metrics (Basic)

## 🚀 Quick Start

### Prerequisites
- Java 17+
- Maven 3.9+
- Docker & Docker Compose (for PostgreSQL)
- Node.js 20+ (optional, will be installed automatically)

A complete environment template for Docker Compose is available in `.env.example`.

```bash
# Copy the template once and adjust the values for your environment
cp .env.example .env

# Start all services (PostgreSQL + Backend + Frontend)
docker compose up -d

# View logs
docker compose logs -f
```

**Application URL:** http://localhost:3000

### Local Development without PostgreSQL

```bash
# Start backend with the H2 development database
cd backend
mvn spring-boot:run -Dspring.profiles.active=dev

# Start frontend
cd frontend
npm install
npm run dev
```

**H2 Console:** http://localhost:8081/h2-console  
**JDBC URL:** `jdbc:h2:file:./data/controla-dev`

### Frontend Development Only

```bash
cd frontend
npm install
npm run dev
```

The frontend development server runs on: http://localhost:3001

## 🐳 Docker

### Build the image

```bash
docker build \
  --build-arg NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8081/api \
  --build-arg BACKEND_URL=http://localhost:8081/api \
  -t controla .
```

### Run the image

```bash
docker run --env-file .env -p 3000:3000 -p 8081:8081 controla
```

## 📁 Project Structure

```
controla/
├── backend/                    # Spring Boot Backend
│   ├── src/main/java/
│   │   └── de/atstck/controla/
│   │       ├── alerts/         # Alert Settings
│   │       ├── config/         # Configuration
│   │       ├── dto/            # Data Transfer Objects
│   │       ├── instance/       # Instance Domain
│   │       └── service/        # CoreApiClient
│   └── pom.xml
├── frontend/                   # Next.js Frontend
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   │   ├── instances/[id]/ # Instance Detail
│   │   │   └── settings/alerts/ # Alert Settings
│   │   └── lib/
│   │       ├── api/           # API Client
│   │       ├── types/         # TypeScript Types
│   │       └── utils/         # Utility Functions
│   └── pom.xml
├── Dockerfile                 # Multi-Stage Docker Build
└── pom.xml                    # Root POM (Monorepo)
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Login (JWT Token)
- `POST /api/auth/register` - Registration
- `GET /api/auth/me` - Current User

### Instances (🔒 Authentication required)
- `GET /api/instances` - List of all instances
- `POST /api/instances` - Create new instance (max. 3)
- `GET /api/instances/{id}` - Instance details
- `GET /api/instances/{id}/workflows` - Workflows of an instance
- `GET /api/instances/{id}/events` - Events/Errors of an instance
- `GET /api/instances/{id}/metrics` - Metrics of an instance

### Alert Settings (🔒 Authentication required)
- `GET /api/alerts/settings` - Get alert settings
- `PUT /api/alerts/settings` - Save alert settings
- `PUT /api/alerts/settings` - Update alert settings

### Health
- `GET /actuator/health` - Backend Health Check

## 💾 Database

### PostgreSQL (Default - Production)

```bash
# Start PostgreSQL only
docker compose -f docker-compose.postgres.yml up -d

# Connect with psql
docker exec -it controla-postgres psql -U controla_user -d controla

# Create backup
docker exec controla-postgres pg_dump -U controla_user controla > backup.sql

# Restore backup
docker exec -i controla-postgres psql -U controla_user -d controla < backup.sql
```

**Credentials:**
- Host: `localhost:5432`
- Database: `controla`
- User: `controla_user`
- Password: `controla_secure_password`

### H2 (Dev - Local Development)

```bash
# Start backend with Dev profile
mvn spring-boot:run -Dspring.profiles.active=dev
```

**H2 Console:** http://localhost:8081/h2-console  
**JDBC URL:** `jdbc:h2:file:./data/controla-dev`  
**User:** `sa` / **Password:** `password`

Data is stored in `./data/` and persists.

📖 **Detailed deployment guide:** [docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md)

## 🛠️ Development

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

### Run the test suite
```bash
mvn test
```

### 🔒 Git Pre-Push Hook

The project contains an **automatic Pre-Push Hook** that runs tests before every push:

- ✅ **Automatic Validation**: Tests are run before every `git push`
- ✅ **Push Protection**: Push is only allowed on successful tests
- ✅ **Already Installed**: Hook is active at `.git/hooks/pre-push`

**Test hook:**
```bash
# Windows PowerShell (Recommended)
.\test-pre-push-hook.ps1

# Windows CMD
test-pre-push-hook.bat

# Linux/Mac
./test-pre-push-hook.sh
```

**Skip hook temporarily** (only in emergencies):
```bash
git push --no-verify
```

## 🎨 Frontend Technologies

- **Next.js 14** - React Framework with App Router
- **TypeScript** - Type Safety
- **Tailwind CSS** - Utility-First CSS
- **TanStack Query** - Server State Management
- **date-fns** - Date Formatting

## 📦 Maven Build

The project uses a Maven Monorepo:

```bash
# Build everything
mvn clean package

# Backend JAR: backend/target/backend-1.0.0-SNAPSHOT.jar
# Frontend Build: frontend/.next/
```

## 🔐 Environment Variables

A complete template for Docker Compose is available in `.env.example`.

### Core Runtime / Docker

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `POSTGRES_DB` | `controla` | Docker only | PostgreSQL database name used by the Compose services |
| `POSTGRES_USER` | `controla_user` | Docker only | PostgreSQL username used by the Compose services |
| `POSTGRES_PASSWORD` | `controla_secure_password` | Docker only | PostgreSQL password used by the Compose services |
| `POSTGRES_PORT` | `5432` | No | Host port for `docker-compose.yml` |
| `POSTGRES_DEV_PORT` | `5433` | No | Host port for `docker-compose.postgres.yml` |
| `SERVER_PORT` | `8081` | No | Spring Boot backend port |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:3001` | No | Allowed browser origins for the backend |
| `CORE_BASE_URL` | `http://localhost:8081` | Yes | Base URL of the Agency Core API |
| `CORE_API_TOKEN` | `dev-apikey-123` | Yes | API token for the Agency Core API |
| `CORE_TENANT_ID` | `123e4567-e89b-12d3-a456-426614174000` | Yes | Tenant ID for multi-tenancy |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5433/controla` (local) / `jdbc:postgresql://postgres:5432/controla` (Compose) | Yes | JDBC URL for the backend database |
| `SPRING_DATASOURCE_USERNAME` | `controla_user` | Yes | Database username for the backend |
| `SPRING_DATASOURCE_PASSWORD` | `controla_secure_password` | Yes | Database password for the backend |
| `CONTROLA_SECURITY_MASTER_KEY` | `change-me-to-a-very-secure-random-string-32-chars` | No | Master key for encrypting stored API keys |
| `JWT_SECRET` | `controla-secret-key-min-32-chars-required-for-security` | No | Secret used to sign JWT tokens |
| `JWT_EXPIRATION` | `86400000` | No | JWT lifetime in milliseconds |
| `BACKEND_URL` | `http://localhost:8081/api` | No | Server-side backend URL used by Next.js rewrites/build |
| `NEXT_PUBLIC_BACKEND_BASE_URL` | `http://localhost:8081/api` | No | Client-side backend URL used by the browser |
| `FRONTEND_URL` | `http://localhost:3000` | No | Public frontend base URL used in password-reset links |

> For local frontend development (`npm run dev`), set `FRONTEND_URL=http://localhost:3001` because the Next.js development server runs on port `3001`.

### Optional Mail / Password Reset Settings

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `MAIL_HOST` | - | Optional | SMTP host for password reset emails |
| `MAIL_PORT` | `587` | Optional | SMTP port |
| `MAIL_USERNAME` | - | Optional | SMTP username |
| `MAIL_PASSWORD` | - | Optional | SMTP password |
| `MAIL_FROM` | `noreply@controla.local` | No | Sender email address |
| `MAIL_FROM_NAME` | `controla` | No | Sender display name |
| `PASSWORD_RESET_TOKEN_VALIDITY_HOURS` | `24` | No | Password reset token lifetime in hours |
| `EMAIL_LOCALE` | `de_DE` | No | Locale used to resolve email templates |
| `EMAIL_BRANDING` | `controla` | No | Branding namespace used to resolve email templates |

## 📈 Extensibility

The project is designed to be easily extended to the Pro version:

- ✨ More than 3 instances
- ✨ Team features
- ✨ Advanced analytics
- ✨ Credentials monitoring
- ✨ Slack/Telegram alerts
- ✨ Custom dashboards

## 📚 Documentation

Further documentation is available in the [`docs/`](./docs) folder:

- **[Documentation Overview](./docs/README.md)** - Entry point for project documentation
- **[Docker Deployment Guide](./docs/DOCKER_DEPLOYMENT.md)** - Docker setup, ports, and environment variables
- **[Architecture Decisions](./docs/04_decisions/README.md)** - Index of architectural decision records
- **[ADR-001: Single Container Deployment](./docs/04_decisions/ADR-001-single-container-deployment.md)** - Deployment decision for backend and frontend

## 📝 License

This project is part of the controla system.

## 🤝 Support

For questions and support, contact the development team.
