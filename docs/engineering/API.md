# API Guide

## Interface Model

DEXIN NEBULA is a modular full-stack application rather than a public API product. Its interfaces are:

1. **Server Actions** for authenticated mutations initiated by application pages.
2. **Route Handlers** for HTTP endpoints, callbacks, downloads, exports, and AI chat.
3. **PostgreSQL functions** for authorized transactional workflows.

There is no versioned, supported third-party REST API at present.

## Current Route-Handler Groups

| Group | Purpose | Access model |
| --- | --- | --- |
| Authentication | session confirmation, sign-out, enterprise identity callback | public entry with state/session validation |
| AI chat | submit an authenticated question and receive a cited answer | authenticated employee, rate limited, read-only |
| Dashboard | retrieve authorized summary data | authenticated and scoped |
| Files | download a permitted business document | authenticated plus document/folder authorization |
| Exports | finance, inventory, product, and receivable workbooks | authenticated plus module/export permission |
| Small-program auth | login exchange, session inspection, logout | environment-dependent token/session validation |

## Request Rules

- Validate body, query, path parameters, and file metadata on the server.
- Resolve identity from the session; do not accept a client-declared user identity as authority.
- Check operation permission and current state before writing.
- Bound list sizes, time ranges, and uploaded content.
- Make externally retried writes idempotent where possible.
- Return safe user messages and trace identifiers, not raw database errors or secrets.

## Response and Error Semantics

HTTP endpoints use appropriate 2xx, 4xx, and 5xx statuses. Authentication failure, forbidden access, missing resources, validation failure, conflict/stale state, rate limiting, upstream unavailability, and internal failure should remain distinguishable without revealing internals.

## External Services

External calls use server-only credentials, explicit timeouts, bounded retry policies, and redacted logging. The current repository contains adapters for managed backend services, an AI provider, enterprise identity, small-program authentication, and private file storage. Availability depends on approved environment configuration.

## Adding an Interface

Document the user/problem, authentication, authorization, schema, state transition, idempotency, rate limit, error contract, audit effect, privacy classification, tests, and rollback behavior. Do not publish private callback domains or production identifiers in this guide.
