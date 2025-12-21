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
RUN npm run build

# --- Stufe 3: Finale Anwendung zusammenstellen ---
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Backend-Artefakt kopieren
COPY --from=backend-builder /build/backend/target/*.jar ./backend.jar

# Frontend-Artefakte kopieren (aus dem 'standalone' Build)
COPY --from=frontend-builder /build/frontend/.next/standalone ./frontend
COPY --from=frontend-builder /build/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /build/frontend/public ./frontend/public

# Umgebungsvariablen für Agency Core API
ENV CORE_BASE_URL=http://host.docker.internal:8081
ENV CORE_API_TOKEN=dev-apikey-123
ENV CORE_TENANT_ID=123e4567-e89b-12d3-a456-426614174000

# Ports freigeben
EXPOSE 8080
EXPOSE 3000

# Start-Skript
CMD ["/bin/sh", "-c", "java -jar backend.jar & node frontend/server.js -p 3000"]

