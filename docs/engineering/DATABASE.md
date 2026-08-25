# Database Guide

## Overview

DEXIN NEBULA uses PostgreSQL through Supabase. The database is both a persistence layer and a security/consistency boundary: constraints, RLS policies, triggers, indexes, and transactional functions support application rules.

## Domain Groups

| Domain | Representative records |
| --- | --- |
| Identity and organization | organizations, departments, employees, roles, employee roles and identity bindings |
| CRM and sales | customers, contacts, follow-ups, legal entities, opportunities, quotations, orders and events |
| Supply chain | suppliers, qualifications, purchase requests/orders, goods receipts, warehouses, batches and movements |
| Finance | finance documents, vouchers, settlements, cash documents/allocations, invoices and reconciliations |
| HRM and OA | HR profiles, contracts, leave, lifecycle, performance, approvals, announcements and weekly reports |
| Documents and governance | knowledge, business documents/folders, access requests, notifications and audit logs |
| AI | conversations, messages and retrieval/tool-call audit records |

The migration files are the authoritative schema history; this table is intentionally conceptual.

## Migration Workflow

1. Confirm the target environment and backup/recovery path.
2. Add a timestamped SQL migration under **supabase/migrations/**.
3. Include schema, constraints, indexes, functions, grants, and RLS changes needed for one coherent change.
4. Verify compatibility with the currently deployed application during rollout.
5. Test authorized and unauthorized roles, duplicate/stale writes, and failure rollback.
6. Never edit a migration already applied to a shared environment; correct it with a later migration.

## Modeling Rules

- Use stable identifiers and explicit foreign keys.
- Preserve organization boundaries on multi-organization-capable records.
- Use fixed-precision numeric types for money and explicit units for quantity.
- Use explicit state machines rather than conflicting booleans.
- Preserve actor and timestamps for critical records.
- Prefer cancellation, reversal, archival, or status history over destructive deletion.
- Index foreign keys and recurring filters after checking query patterns.

## Row-Level Security

RLS policies enforce organization, self, department, assignment, and functional-role access. Service code must still validate intent, current state, operation permission, and sensitive fields. Administrative service credentials are reserved for tightly controlled server tasks and must never reach the browser.

## Transactions

Order fulfilment, goods receipt, inventory execution, settlements, approval transitions, and similar multi-table changes require one atomic operation. State/version validation must happen inside the same transaction that writes effects.

## Seed and Test Data

Only synthetic examples belong in source control. Seed scripts must not contain real names, addresses, contacts, prices, bank details, employee identifiers, or credentials.

## Backup and Recovery

Before destructive or high-risk migrations, document backup ownership, restore procedure, application compatibility, and recovery verification. Exact production project identifiers and infrastructure locations are maintained outside public documentation.
