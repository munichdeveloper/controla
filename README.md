# Controla - Community Edition

[![Periodic Quality Review](https://github.com/munichdeveloper/controla/actions/workflows/periodic-quality-review.yml/badge.svg?branch=main)](https://github.com/munichdeveloper/controla/actions/workflows/periodic-quality-review.yml)

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

### 🩺 Diagnostics

Find out why an instance has problems: DNS and reachability, TLS certificate, n8n health and database readiness, API key and failed executions in one report.

### 📊 Basic metrics

Understand execution behavior at a glance: failed executions grouped into error patterns, plus the latest workflow errors per instance.

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

### Hostinger VPS

[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/docker-hosting?compose_url=https%3A%2F%2Fraw.githubusercontent.com%2Fmunichdeveloper%2Fcontrola%2Frefs%2Fheads%2Fmain%2Fdocker-compose.hostinger.yml)

The button loads the production Compose file. A configured Traefik proxy, DNS
hostname and unique installation secrets are required. Follow the
[Hostinger deployment guide](docs/HOSTINGER.md) before deploying; maintainers must
publish the public container image once before the button is ready for use.

### Local prerequisites

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

## 📋 Community Edition Scope

* Unlimited connected n8n instances on your own infrastructure
* Basic monitoring
* Basic metrics
* Email alerts

The Community license reports `maxInstances: -1` (no product-side cap). Practical
capacity depends on your infrastructure and workload; this is not a throughput or
support SLA. Self-hosters operate and update Controla themselves. Manual workflow
export remains included; workflow import, scheduled Google Drive exports and
Enterprise/Companion features are not added by removing the instance cap.

The hosted offer (Managed Hosting) replaces the license service: Solo is EUR 29/month for up to 10
instances; Agency is EUR 79/month for up to 30 and adds import and scheduled Drive
exports. Finite extension limits remain enforced per tenant using a PostgreSQL
transaction and tenant-scoped advisory lock, including across backend processes.
See [the confirmed CE decision](docs/CE_LIMIT_RECOMMENDATION.md).

Run backend validation with `mvn -B -pl backend verify`. The concurrency tests use
Testcontainers with PostgreSQL 16 and require a running Docker daemon.

---

## 🐳 Docker

### Build

```bash
docker build \
  --build-arg NEXT_PUBLIC_BACKEND_BASE_URL=/api \
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
* GET /api/instances/{id}/error-patterns – failed executions grouped by error
* GET /api/instances/{id}/export – manual workflow export (ZIP)
* GET /api/instances/{id}/diagnostics – diagnostic report (reachability, TLS, n8n health and readiness, API key, failed executions)

### License & features

* GET /api/license – edition, instance limit and the feature keys of the running backend

### Alerts

* GET /api/alerts/settings
* PUT /api/alerts/settings

---

## 🔐 Configuration

See `.env.example` for all configuration options.

---

## 📦 License

Controla Community Edition is licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) and [licensing and distribution notes](docs/LICENSING.md); the decision and the CE/Premium boundary are recorded in [ADR-003](docs/04_decisions/ADR-003-open-core-apache-license.md). Previous releases remain under their originally published license (including AGPLv3).

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
