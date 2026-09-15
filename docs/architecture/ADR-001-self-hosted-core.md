# ADR-001 — Self-hosted Core

Status: ACCEPTED
Date: 2026-09-15

## Decision
Panda Product OS will not depend on Supabase. M0 uses a PostgreSQL-first self-hosted architecture on the Panda Ubuntu VPS.

## Core
- Next.js + TypeScript
- PostgreSQL 17
- Auth.js
- Redis
- Core Worker / Scheduler
- S3-compatible object storage adapter (implementation may be MinIO or external S3-compatible storage)
- Docker Compose
- Reverse proxy / TLS edge

## Security model
Authorization is defense-in-depth: application RBAC plus PostgreSQL constraints/policies for tenant isolation. Secrets stay server-side. No raw credentials are stored in application records.

## Environments
LOCAL → STAGING → PRODUCTION.

Production promotion requires explicit gate approval and verified backup/restore and rollback evidence.

## Consequences
+ PostgreSQL portability and full ownership.
+ No BaaS vendor dependency.
+ Workers and scheduler share one infrastructure model.
- Panda owns DB operations, backups, upgrades, monitoring and recovery.
