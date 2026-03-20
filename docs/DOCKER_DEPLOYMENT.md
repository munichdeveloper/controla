# Docker Deployment Guide

## Architecture

Controla uses a **single-container architecture** for the backend and frontend:

```
┌─────────────────────────────────────┐
│  Docker Container: controla         │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Backend (Spring Boot)       │  │
│  │  Port: 8081                  │  │
│  │  Process: java -jar ...      │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Frontend (Next.js)          │  │
│  │  Port: 3000                  │  │
│  │  Process: node server.js     │  │
│  └──────────────────────────────┘  │
│                                     │
│  Start Script: /app/start.sh       │
└─────────────────────────────────────┘
         ↓ Port Mapping ↓
    3000:3000    8081:8081
```

**See also:** [ADR-001: Single Container Deployment](04_decisions/ADR-001-single-container-deployment.md)

## Ports

| Port | Service | Description |
|------|---------|-------------|
| 3000 | Frontend | Next.js User Interface |
| 8081 | Backend | Spring Boot REST API |
| 5432 | PostgreSQL | Database (separate container) |

## Environment Variables

A complete template for Docker Compose is available in [`.env.example`](../.env.example).

### Backend (Spring Boot)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVER_PORT` | No | `8081` | Spring Boot backend port |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3000,http://localhost:3001` | Allowed browser origins |
| `SPRING_DATASOURCE_URL` | Yes | `jdbc:postgresql://postgres:5432/controla` in Compose | PostgreSQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | Yes | `controla_user` | Database user |
| `SPRING_DATASOURCE_PASSWORD` | Yes | `controla_secure_password` | Database password |
| `CORE_BASE_URL` | Yes | `http://host.docker.internal:8081` | Agency Core API base URL |
| `CORE_API_TOKEN` | Yes | `dev-apikey-123` | Agency Core API token |
| `CORE_TENANT_ID` | Yes | `123e4567-e89b-12d3-a456-426614174000` | Agency Core tenant ID |
| `CONTROLA_SECURITY_MASTER_KEY` | No | `change-me-to-a-very-secure-random-string-32-chars` | Master key for encryption |
| `JWT_SECRET` | No | `controla-secret-key-min-32-chars-required-for-security` | JWT signing secret |
| `JWT_EXPIRATION` | No | `86400000` | JWT lifetime in milliseconds |
| `FRONTEND_URL` | No | `http://localhost:3000` | Public frontend URL used in password-reset links |

### Frontend (Next.js)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_BACKEND_BASE_URL` | No | `http://localhost:8081/api` | Client-side backend URL embedded into the browser bundle |
| `BACKEND_URL` | No | `http://localhost:8081/api` | Server-side backend URL used for rewrites and build-time configuration |

### Optional Mail / Password Reset

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAIL_HOST` | Optional | - | SMTP host for password reset emails |
| `MAIL_PORT` | Optional | `587` | SMTP port |
| `MAIL_USERNAME` | Optional | - | SMTP username |
| `MAIL_PASSWORD` | Optional | - | SMTP password |
| `MAIL_FROM` | No | `noreply@controla.local` | Sender email address |
| `MAIL_FROM_NAME` | No | `controla` | Sender display name |
| `PASSWORD_RESET_TOKEN_VALIDITY_HOURS` | No | `24` | Password reset token validity |
| `EMAIL_LOCALE` | No | `de_DE` | Email template locale |
| `EMAIL_BRANDING` | No | `controla` | Email template branding namespace |

⚠️ **Important:** `NEXT_PUBLIC_BACKEND_BASE_URL` is used during the frontend build. The Compose file therefore passes it both as a build argument and as a runtime environment variable.

## Docker Compose Example

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-controla}
      POSTGRES_USER: ${POSTGRES_USER:-controla_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-controla_secure_password}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  controla:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_BACKEND_BASE_URL: ${NEXT_PUBLIC_BACKEND_BASE_URL:-http://localhost:8081/api}
        BACKEND_URL: ${BACKEND_URL:-http://localhost:8081/api}
    ports:
      - "3000:3000"
      - "8081:8081"
    environment:
      SERVER_PORT: ${SERVER_PORT:-8081}
      CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-http://localhost:3000,http://localhost:3001}
      CORE_BASE_URL: ${CORE_BASE_URL:-http://host.docker.internal:8081}
      CORE_API_TOKEN: ${CORE_API_TOKEN:-dev-apikey-123}
      CORE_TENANT_ID: ${CORE_TENANT_ID:-123e4567-e89b-12d3-a456-426614174000}
      SPRING_DATASOURCE_URL: ${SPRING_DATASOURCE_URL:-jdbc:postgresql://postgres:5432/controla}
      SPRING_DATASOURCE_USERNAME: ${SPRING_DATASOURCE_USERNAME:-controla_user}
      SPRING_DATASOURCE_PASSWORD: ${SPRING_DATASOURCE_PASSWORD:-controla_secure_password}
      CONTROLA_SECURITY_MASTER_KEY: ${CONTROLA_SECURITY_MASTER_KEY:-change-me-to-a-very-secure-random-string-32-chars}
      JWT_SECRET: ${JWT_SECRET:-controla-secret-key-min-32-chars-required-for-security}
      JWT_EXPIRATION: ${JWT_EXPIRATION:-86400000}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:3000}
      BACKEND_URL: ${BACKEND_URL:-http://localhost:8081/api}
      NEXT_PUBLIC_BACKEND_BASE_URL: ${NEXT_PUBLIC_BACKEND_BASE_URL:-http://localhost:8081/api}
    depends_on:
      - postgres

volumes:
  postgres_data:
```

## Container Startup Process

The container uses a shell script (`/app/start.sh`) to start both services:

```bash
#!/bin/sh
echo "Starting Backend..."
java -jar /app/backend.jar &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

echo "Starting Frontend..."
cd /app/frontend && node server.js &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"

wait $BACKEND_PID $FRONTEND_PID
```

This ensures that:
- Both processes run in parallel
- The container runs as long as at least one service is active
- Logs from both services appear in the container output

## Network Communication

### Server-side (Next.js SSR)

Next.js server → backend: `http://localhost:8081/api`

- Both services run in the same container
- `localhost` works directly
- No DNS or service discovery is needed

### Client-side (Browser)

Browser → backend: `http://<server-ip-or-domain>:8081/api`

- Port `8081` must be exposed
- `NEXT_PUBLIC_BACKEND_BASE_URL` defines the URL
- CORS is configured in the backend

### Why rewrites do not work in production

Next.js rewrites work in development mode. In the `standalone` production build, rewrites are evaluated at build time but do not act as a runtime reverse proxy.

**Alternatives:**
- ✅ Direct communication (current approach)
- ❌ Nginx reverse proxy (more complexity)
- ❌ Traefik/Caddy (additional operational overhead for the Community Edition)

## Commands

### Build and start

```bash
# Build everything from scratch
docker compose build --no-cache

# Start
docker compose up -d

# Follow logs
docker compose logs -f
```

### Debugging

```bash
# Open a shell in the container
docker exec -it controla-controla-1 sh

# Filter backend logs
docker logs controla-controla-1 2>&1 | grep "Spring"

# Filter frontend logs
docker logs controla-controla-1 2>&1 | grep "Frontend"

# Check processes in the container
docker exec controla-controla-1 ps aux

# Check ports
docker exec controla-controla-1 netstat -tlnp
```

### Health checks

```bash
# Backend health
curl http://localhost:8081/actuator/health

# Frontend health (HTML response)
curl http://localhost:3000

# Login test (backend API)
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## Troubleshooting

### Frontend cannot reach the backend

**Symptom:** 404 or connection refused on an API call

**Solution:**
1. Check if `NEXT_PUBLIC_BACKEND_BASE_URL` is set:
   ```bash
   docker exec controla-controla-1 env | grep NEXT_PUBLIC
   ```

2. Check if the backend is running:
   ```bash
   curl http://localhost:8081/actuator/health
   ```

3. Check CORS logs in the backend:
   ```bash
   docker logs controla-controla-1 | grep CORS
   ```

### Only the backend starts, no frontend

**Symptom:** Port `3000` does not respond

**Solution:**
1. Check if frontend files were copied:
   ```bash
   docker exec controla-controla-1 ls -la /app/frontend
   ```

2. Check the start script:
   ```bash
   docker exec controla-controla-1 cat /app/start.sh
   ```

3. Start the frontend manually for debugging:
   ```bash
   docker exec -it controla-controla-1 sh
   cd /app/frontend
   node server.js
   ```

### Port conflict

**Symptom:** `bind: address already in use`

**Solution:**
```bash
# Check which process is using the port
netstat -ano | findstr :8081
netstat -ano | findstr :3000

# Windows: Kill process
taskkill /PID <PID> /F

# Or use different ports in docker-compose.yml:
ports:
  - "3001:3000"
  - "8082:8081"
```

## Performance

### Resource limits

```yaml
controla:
  build: .
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

### Log rotation

```yaml
controla:
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

## Production

For production deployment:

1. **Manage secrets:**
   ```bash
   # .env file (DO NOT commit!)
   POSTGRES_PASSWORD=<strong-password>
   CORE_API_TOKEN=<secret-token>
   CONTROLA_SECURITY_MASTER_KEY=<32-char-random-string>
   ```

2. **Set up HTTPS:**
   - Reverse proxy (Nginx/Traefik) in front of the container
   - SSL certificate (Let's Encrypt)

3. **Add health checks:**
   ```yaml
   controla:
     healthcheck:
       test: ["CMD", "curl", "-f", "http://localhost:8081/actuator/health"]
       interval: 30s
       timeout: 10s
       retries: 3
   ```

4. **Backups:**
   ```bash
   # Automate PostgreSQL backup
   docker exec controla-postgres pg_dump -U controla_user controla > backup-$(date +%Y%m%d).sql
   ```

## See Also

- [ADR-001: Single Container Deployment](04_decisions/ADR-001-single-container-deployment.md)
- [Glossary](../doc-meta/glossary.yaml)
- [System Architecture](../doc-meta/system.yaml)
