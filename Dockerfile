ARG NODE_VERSION=24.22.0
ARG NPM_VERSION=11.9.0

# --- Stufe 1: Backend bauen ---
FROM maven:3.9-eclipse-temurin-17 AS backend-builder
WORKDIR /build/backend
COPY backend/pom.xml ./pom.xml
COPY backend/src ./src
# pom.xml des Root-Projekts kopieren, um die Parent-Beziehung aufzulösen
COPY pom.xml ./..
RUN mvn -B -f pom.xml clean package -DskipTests

# --- Stufe 2: Frontend bauen ---
FROM node:${NODE_VERSION}-bookworm-slim AS frontend-builder
ARG NPM_VERSION
RUN npm install --global npm@${NPM_VERSION}
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
# Backend-URLs für Frontend und Rewrites zur Build-Zeit setzen
ARG NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8081/api
ARG BACKEND_URL=http://localhost:8081/api
ENV NEXT_PUBLIC_BACKEND_BASE_URL=${NEXT_PUBLIC_BACKEND_BASE_URL}
ENV BACKEND_URL=${BACKEND_URL}
RUN npm run build

# --- Stufe 3: Finale Anwendung zusammenstellen ---
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Laufzeit benötigt dieselbe Node-Binärdatei und npm-Version wie der Build.
RUN apt-get update && \
    apt-get install -y --no-install-recommends libatomic1 && \
    rm -rf /var/lib/apt/lists/*
COPY --from=frontend-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend-builder /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Backend-Artefakt kopieren
COPY --from=backend-builder /build/backend/target/*-exec.jar ./backend.jar

# Frontend-Artefakte kopieren (aus dem 'standalone' Build)
COPY --from=frontend-builder /build/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /build/frontend/.next/static ./frontend/.next/static

# Umgebungsvariablen für Agency Core API
ENV CORE_BASE_URL=http://host.docker.internal:8081
ENV CORE_API_TOKEN=dev-apikey-123
ENV CORE_TENANT_ID=123e4567-e89b-12d3-a456-426614174000

# URLs für Frontend- und Backend-Kommunikation
ENV BACKEND_URL=http://localhost:8081/api
ENV NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8081/api
ENV FRONTEND_URL=http://localhost:3000

# Ports freigeben
EXPOSE 8081
EXPOSE 3000

# Start-Script erstellen
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting Backend..."' >> /app/start.sh && \
    echo 'java -jar /app/backend.jar &' >> /app/start.sh && \
    echo 'BACKEND_PID=$!' >> /app/start.sh && \
    echo 'echo "Backend started with PID: $BACKEND_PID"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo 'echo "Starting Frontend..."' >> /app/start.sh && \
    echo 'cd /app/frontend && node server.js &' >> /app/start.sh && \
    echo 'FRONTEND_PID=$!' >> /app/start.sh && \
    echo 'echo "Frontend started with PID: $FRONTEND_PID"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo 'wait $BACKEND_PID $FRONTEND_PID' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start-Skript ausführen
CMD ["/app/start.sh"]
