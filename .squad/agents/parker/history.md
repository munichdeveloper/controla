# Project Context

- **Project:** controla
- **Owner:** j
- **Added:** 2026-03-19

## Core Context

Parker owns core Spring Boot implementation for Controla.

## Tech Stack

- Java 17 / Spring Boot
- JPA / PostgreSQL
- Docker Compose

## Learnings

- Controla backend already covers auth, instances, alerts, backups, licensing, and password reset.
- Team memory now enforces Copilot-instructions compliance and OpenTelemetry constraints (env-driven config, secure defaults, HTTP + RestTemplate + InstanceStatusChecker instrumentation), so backend changes should preserve these guardrails.
