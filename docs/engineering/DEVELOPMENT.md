# Development Guide

## Prerequisites

- Node.js 20.9 or later
- npm and the committed lockfile
- A non-production Supabase project for database-backed workflows
- Environment-specific credentials supplied through local/runtime environment variables

Never use production credentials or real business data for local development.

## Setup

~~~bash
npm ci
cp .env.example .env.local
npm run dev
~~~

Review every value in the local environment file and replace examples with development-only configuration. Do not commit environment files.

## Repository Map

~~~text
src/app/                 routes, pages, server actions, route handlers
src/components/          shared UI and business components
src/config/              navigation and stable configuration
src/features/            domain logic and feature components
src/lib/                 shared infrastructure and utilities
src/types/               shared types
supabase/migrations/     ordered schema, policies, functions, indexes
tests/                   workflow and regression tests
docs/                    canonical and focused documentation
~~~

## Working Conventions

1. Read the root README, this guide, and the affected module document.
2. Inspect existing uncommitted changes before editing; preserve unrelated work.
3. Keep workflow, permission, inventory, and monetary rules out of presentation-only components.
4. Validate all untrusted input on the server.
5. Add a new migration for database changes; never rewrite an applied migration.
6. Update tests and documentation with behavior, permission, schema, or deployment changes.

## Implementation Boundaries

- Use Server Actions for authenticated UI mutations where appropriate.
- Use Route Handlers for HTTP integrations, callbacks, downloads, exports, and the AI endpoint.
- Use PostgreSQL transactions/functions for critical multi-table effects.
- Treat navigation and disabled buttons as user guidance, not authorization.
- Bound list/retrieval queries and provide loading, empty, error, and forbidden states.

## Local Quality Checks

~~~bash
npm run check
npm run test:workflow
npm run build
~~~

Run checks proportionate to the change, but release candidates require the complete relevant set. See [Testing](./TESTING.md).

## Documentation

Canonical product and architecture documents live at the top of **docs/**. Module contracts live in **docs/modules/**. Focused legacy specifications remain linked from [the documentation index](../README.md) where they contain useful operational detail.
