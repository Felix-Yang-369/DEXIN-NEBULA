# Architecture Decision Record Index

This file records decisions that are evidenced by the repository. Dates are the earliest supporting migration or current documentation date where available; they are not reconstructed meeting dates.

## ADR-001 — Managed PostgreSQL and Supabase

- **Context:** The system needs authentication, relational workflows, row-level data scope, storage metadata, and auditable schema evolution.
- **Options considered:** custom auth/database stack; document database; managed PostgreSQL with Supabase.
- **Decision:** Use Supabase Auth and PostgreSQL with versioned SQL migrations and RLS.
- **Rationale:** Relational constraints and transactions fit inventory, finance, and approval workflows; RLS provides a database authorization boundary.
- **Trade-offs:** Platform-specific policies/functions and migration discipline increase coupling.
- **Consequences:** Every exposed table needs reviewed RLS; privileged keys remain server-only.
- **Date / status:** 2026-07 / Accepted.

## ADR-002 — Next.js as Web Application and Backend-for-Frontend

- **Context:** The product requires tightly integrated authenticated pages, forms, downloads, exports, and service endpoints.
- **Options considered:** separate SPA and API services; Next.js full-stack application.
- **Decision:** Use Next.js App Router, Server Actions, and Route Handlers as a modular monolith.
- **Rationale:** Shared types and one deployment unit reduce early operational complexity.
- **Trade-offs:** Domain boundaries require discipline; compute-heavy jobs may later need separate workers.
- **Consequences:** Business logic belongs in domain services or database functions, not page components.
- **Date / status:** Current repository baseline / Accepted.

## ADR-003 — Database-Enforced Authorization

- **Context:** Navigation hiding cannot protect customer, financial, inventory, or personnel rows.
- **Options considered:** client-only role checks; API-only checks; layered server checks plus RLS.
- **Decision:** Combine authenticated server checks with PostgreSQL RLS and scoped database functions.
- **Rationale:** Defense in depth reduces accidental cross-role disclosure.
- **Trade-offs:** Policies are harder to debug and must be tested alongside application logic.
- **Consequences:** Permission changes require migration review and role-based tests.
- **Date / status:** 2026-07 / Accepted.

## ADR-004 — Transactional Cross-Module Workflows

- **Context:** Fulfilment and receiving affect orders, stock, deliveries, receivables, and payables together.
- **Options considered:** sequential client writes; loosely coordinated server writes; PostgreSQL transactions/functions.
- **Decision:** Use transactional database operations for critical multi-table effects.
- **Rationale:** Partial success would produce incorrect stock or financial balances.
- **Trade-offs:** Some domain logic is database-specific and needs careful migrations.
- **Consequences:** State and version checks must occur inside the transaction.
- **Date / status:** 2026-08 / Accepted.

## ADR-005 — Read-Only, Grounded AI First

- **Context:** Enterprise AI is useful only when answers respect permissions and unsupported claims are controlled.
- **Options considered:** generic chatbot; direct autonomous tools; retrieval-grounded read-only assistant.
- **Decision:** Start with server-side model calls, permission-aware retrieval, cited sources, bounded history, and no write tools.
- **Rationale:** This creates useful assistance while keeping operational effects outside the model.
- **Trade-offs:** Deterministic retrieval has limited semantic recall and cannot complete actions.
- **Consequences:** Agentic writes remain blocked until explicit policy, confirmation, idempotency, audit, and evaluation exist.
- **Date / status:** 2026-07 / Accepted; retrieval enhancement In Progress.

## ADR-006 — Private Binary Storage with Relational Metadata

- **Context:** Business documents need database permissions and metadata, while large binaries require private storage.
- **Options considered:** public object URLs; database binary storage; private file service plus PostgreSQL metadata.
- **Decision:** Store file metadata and access rules in PostgreSQL; proxy approved binary operations through the server to private storage.
- **Rationale:** The browser never receives private storage credentials, and metadata participates in RLS/search.
- **Trade-offs:** Cross-system consistency and recovery require explicit handling.
- **Consequences:** Upload/download operations validate permission and record recoverable failures.
- **Date / status:** 2026-07 / Accepted.

## Future ADRs

Formal decisions are still needed for observability, search indexing, background jobs, AI tool governance, data retention, and public/open-source licensing. They remain **TODO** until options and owners are confirmed.
