# --- Stufe 1: Backend bauen ---
FROM maven:3.9-eclipse-temurin-17 AS backend-builder
WORKDIR /build/backend
COPY backend/pom.xml ./pom.xml
COPY backend/src ./src
# pom.xml des Root-Projekts kopieren, um die Parent-Beziehung aufzulösen
COPY pom.xml ./..
RUN mvn -B -f pom.xml clean package -DskipTests

# --- Stufe 2: Frontend bauen ---
FROM node:20-slim AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
# Backend URL für Frontend setzen (zur Build-Zeit)
ENV NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8081/api
RUN npm run build

# --- Stufe 3: Finale Anwendung zusammenstellen ---
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Node.js installieren (für Frontend)
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Backend-Artefakt kopieren
COPY --from=backend-builder /build/backend/target/*-exec.jar ./backend.jar

# Frontend-Artefakte kopieren (aus dem 'standalone' Build)
COPY --from=frontend-builder /build/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /build/frontend/.next/static ./frontend/.next/static

# Umgebungsvariablen für Agency Core API
ENV CORE_BASE_URL=http://host.docker.internal:8081
ENV CORE_API_TOKEN=dev-apikey-123
ENV CORE_TENANT_ID=123e4567-e89b-12d3-a456-426614174000

# Backend URL für Server-seitige API-Aufrufe in Next.js
ENV BACKEND_URL=http://localhost:8081/api

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

