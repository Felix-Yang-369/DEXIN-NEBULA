# Deployment Guide

## Deployment Model

DEXIN NEBULA is deployed as a production-built Node.js/Next.js service behind a TLS reverse proxy, with managed authentication/database services and private storage configured separately. This public-safe guide intentionally excludes production domains, addresses, ports, process names, account IDs, regions, and filesystem paths.

## Release Inputs

- Reviewed source and lockfile
- Node.js 22 LTS and npm 10 or later
- Environment-specific secrets in an approved secret store
- Ordered database migrations and compatibility notes
- Successful relevant checks and acceptance evidence
- Identified previous release and rollback owner

## Recommended Release Flow

1. Freeze and describe the application/database release scope.
2. Confirm backup and recovery readiness for database-impacting changes.
3. Install locked dependencies and build in an isolated release directory or CI job.
4. Apply backward-compatible migrations in the approved order.
5. Start the candidate independently and run health plus critical-route checks.
6. Switch traffic only after candidate validation.
7. Verify authentication, authorization, static assets, core workflows, logs, and external callbacks.
8. Record the sanitized release result; keep operational evidence in an access-controlled system.

## Configuration

Separate development, preview, and production configuration. Inject variables at runtime; do not package environment files into artifacts. Browser-visible configuration must be intentionally public. Rotate any secret that appears in logs, source control, screenshots, or documentation.

## Database Changes

Applied migrations are immutable. Prefer expand/migrate/contract sequences for incompatible changes so the old and new application can coexist during rollout. Destructive changes need explicit authorization, verified backup, tested restoration, and a defined stop condition.

## Health and Acceptance

At minimum verify TLS, login/logout/recovery, protected-route behavior, one scoped read per critical module, release-specific writes, static asset delivery, database connectivity, external-service degradation, and absence of new error spikes.

## Rollback

Application rollback switches traffic to the last verified immutable release. Database rollback may require forward correction or data restoration and therefore must be designed per migration. Never assume reverting application files reverses schema or business effects.

## Operational Records

Keep exact infrastructure inventory, access procedures, callback configuration, deployment identifiers, and recovery commands in a private operations system with access control. Public repository records should contain only sanitized scope, validation outcome, and known limitations.
