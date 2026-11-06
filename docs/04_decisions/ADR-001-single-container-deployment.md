# ADR-001: Single Container Deployment for Backend and Frontend

**Status:** Accepted  
**Date:** 2026-01-16  
**Decision Makers:** Development Team

## Context

Controla consists of a Spring Boot backend (port 8081) and a Next.js frontend (port 3000). For deployment, both services must work together. There are several possible deployment strategies:

1. Separate containers for backend and frontend
2. Backend embedded in frontend (static files)
3. Single container with both services
4. Nginx reverse proxy in front of separate containers

### Challenges

- **Next.js Production Build:** In `standalone` mode, rewrites don't work like in dev mode
- **API Communication:** Frontend must communicate with backend both server-side (SSR) and client-side (browser)
- **Port Exposition:** Both services need external accessibility
- **Simplicity:** Deployment should be simple for Community Edition

## Decision

We use **a single container** with both services:

1. **Container Structure:**
   - Backend (Spring Boot) on port 8081
   - Frontend (Next.js standalone) on port 3000
   - Start script (`start.sh`) orchestrates both processes

2. **Network Configuration:**
   - Both ports are exposed: `3000:3000` and `8081:8081`
   - Frontend accesses backend **directly** (no reverse proxy)
   - Server-side calls: `localhost:8081` (within container)
   - Client-side calls: `NEXT_PUBLIC_BACKEND_BASE_URL` (configurable from outside)

3. **Environment Variables:**
   ```yaml
   environment:
     - NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8081/api  # Browser → Backend
     - BACKEND_URL=http://localhost:8081/api                   # Next.js Server → Backend (optional)
   ```

4. **Start Script:**
   ```bash
   #!/bin/sh
   java -jar backend.jar &
   BACKEND_PID=$!
   cd frontend && node server.js &
   FRONTEND_PID=$!
   wait $BACKEND_PID $FRONTEND_PID
   ```

## Alternatives Considered

### 1. Separate Containers

- **Pro:** Independent scaling
- **Contra:** More complex orchestration, service discovery required

### 2. Backend Embedded in Frontend

- **Pro:** Single port (3000), backend internal
- **Contra:** Additional complexity, another service, config management

### 3. Nginx Reverse Proxy

- **Pro:** Truly single-port
- **Contra:** Spring Boot and Node.js in one process = not practical

## Consequences

### Positive

- ✅ **Simple Deployment:** One `docker-compose up` starts everything
- ✅ **No Reverse Proxy Complexity:** Direct communication reduces moving parts
- ✅ **Flexibility:** Both ports exposed → external access possible
- ✅ **Developer-Friendly:** Logs from both services in one stream

### Negative

- ⚠️ **Scaling:** Backend and frontend scale together. CE no longer has a product-side instance cap (decision #39); operators must size their infrastructure for the workload.
- ⚠️ **Process Management:** A crash of one service doesn't automatically stop the container
- ⚠️ **Security:** Backend port is directly exposed (CORS and JWT still protect)

### Neutral

- 🔄 **No Next.js Rewrite in Production:** Browser communicates directly with `:8081/api`
- 🔄 **NEXT_PUBLIC_BACKEND_BASE_URL Required:** Must be set in docker-compose.yml or at runtime

## Implementation Notes

- `Dockerfile` creates multi-stage build (Backend Builder, Frontend Builder, Runtime)
- `docker-compose.yml` exposes both ports
- `next.config.mjs` keeps rewrites for dev mode (ignored in production)
- `start.sh` is created at build time in `/app/`

## Related

- See: `/doc-meta/glossary.yaml` (NEXT_PUBLIC_BACKEND_BASE_URL, BACKEND_URL)
- See: `Dockerfile`
- See: `docker-compose.yml`  


