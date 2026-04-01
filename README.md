# Controla - Community Edition

Controla helps you run n8n reliably in production.

---

## Why Controla exists

If you are using n8n beyond simple automations, you will run into problems:

* workflows fail silently
* debugging becomes manual and slow
* multiple instances are hard to track
* scaling introduces instability

Controla gives you an operational layer on top of n8n.

---

## What you get

### 🔍 Centralized visibility

Monitor multiple n8n instances in one place.

### 🚨 Error awareness

See workflow errors across all instances without digging through logs.

### 📡 Status monitoring

Know immediately when an instance goes down.

### 📊 Basic metrics

Understand execution behavior at a glance.

### ✉️ Alerts

Get notified when something breaks.

---

## Who this is for

Controla is built for:

* developers running n8n in production
* builders of AI agents using n8n as orchestration layer
* freelancers and agencies managing multiple client instances

---

## What Controla is not

* not a replacement for n8n
* not a workflow builder
* not a low-code platform

Controla focuses on **operations, monitoring and reliability**.

---

## 🏗️ Architecture

* Backend: Spring Boot (Java 17)
* Frontend: Next.js 14 (TypeScript, Tailwind, TanStack Query)
* Database: PostgreSQL 16 (H2 for development)
* Auth: JWT (Spring Security)
* Deployment: Docker Compose

---

## How it works

Controla connects to your n8n instances and collects:

* workflow executions
* error events
* instance health data

This data is normalized and stored for:

* monitoring
* alerting
* analytics

---

## 🚀 Quick Start

### Prerequisites

* Docker & Docker Compose

### Start everything

```bash
cp .env.example .env
docker compose up -d
```

Open:
http://localhost:3000

---

### What you should see

After startup:

1. Register a user
2. Add your first n8n instance
3. Open the instance dashboard
4. See status + workflows + events

---

## 📋 Community Edition Limits

* Up to 3 n8n instances
* Basic monitoring
* Basic metrics
* Email alerts

---

## 🐳 Docker

### Build

```bash
docker build \
  --build-arg NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8081/api \
  --build-arg BACKEND_URL=http://localhost:8081/api \
  -t controla .
```

### Run

```bash
docker run --env-file .env -p 3000:3000 -p 8081:8081 controla
```

---

## 🔌 API Overview

### Auth

* POST /api/auth/login
* POST /api/auth/register
* GET /api/auth/me

### Instances

* GET /api/instances
* POST /api/instances
* GET /api/instances/{id}
* GET /api/instances/{id}/workflows
* GET /api/instances/{id}/events
* GET /api/instances/{id}/metrics

### Alerts

* GET /api/alerts/settings
* PUT /api/alerts/settings

---

## 🔐 Configuration

See `.env.example` for all configuration options.

---

## 📦 License

Controla Community Edition is licensed under AGPLv3.

---

## 🚧 Roadmap (excerpt)

* advanced alerting rules
* circuit breaker for workflows
* multi-user / teams
* integrations (Slack, Telegram)
* advanced analytics

---

## 🤝 Contributing

Contributions are welcome.

Before contributing, please open an issue to discuss your idea.

---

## 📚 Documentation

See `/docs` for:

* deployment
* architecture decisions
* technical details
