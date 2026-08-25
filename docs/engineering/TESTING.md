# Testing Guide

## Test Strategy

Testing combines static checks, domain/workflow regression tests, production builds, database/RLS verification, and role-based user acceptance. Test counts change over time; passing a historical number is not a quality claim.

## Commands

~~~bash
npm run check          # ESLint and TypeScript
npm run test:workflow  # Node-based workflow/regression suite
npm run build          # production compilation and route build
~~~

## What to Test

| Change | Required emphasis |
| --- | --- |
| UI/read-only view | render, loading, empty, error, forbidden, responsive behavior |
| State machine | every allowed transition and every invalid/stale transition |
| Permissions | authorized role plus negative role/row/field/export cases |
| Money/inventory | boundary values, precision, duplicate submission, transaction rollback |
| Migration/RLS | clean apply, existing-data compatibility, policy matrix, indexes, recovery |
| Integration | timeout, malformed response, unavailable service, retry/idempotency, redacted logs |
| AI/search | normalization, ranking, scope isolation, source support, refusal, injection, outage |

## Workflow Acceptance

Canonical scenarios should cover customer-to-quotation, sales order-to-fulfilment-to-receivable, purchase request-to-receipt-to-payable, cash allocation/reversal, leave/expense approval, document access, and search/AI permission boundaries.

For each scenario record the role, preconditions, action, expected state/data effects, forbidden alternatives, and cleanup. Prefer isolated synthetic records.

## Database Testing

Verify constraints and policies with a real non-production PostgreSQL/Supabase environment when behavior depends on database execution. Unit tests of helper functions cannot replace RLS or transaction tests.

## AI Evaluation

Regression tests validate deterministic routing/search helpers; a versioned benchmark and human rubric evaluate grounded answers. Do not interpret a successful model response as proof of correctness. See [Evaluation](../EVALUATION.md).

## Completion Criteria

A change is complete only when its user flow, server/database authorization, loading/empty/error states, relevant automated checks, data migration/recovery path, audit requirements, documentation, and manual acceptance evidence are adequate for its risk.

## Reporting

Report commands run, results, environment class, unrun checks and reasons, affected scenarios, known limitations, and any required human acceptance. Never include secrets or real data in test output or screenshots.
