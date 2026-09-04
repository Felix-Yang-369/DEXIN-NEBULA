# Security Guide

## Security Model

DEXIN NEBULA applies defense in depth: authenticated sessions, server authorization, PostgreSQL RLS, field and operation controls, private file access, validation, transactional writes, and audit records. No single UI check is considered a security boundary.

## Data Classification

| Class | Examples | Handling |
| --- | --- | --- |
| Public | sanitized architecture and synthetic demo content | privacy-reviewed before publication |
| Internal | routine operational metadata | authenticated access and scoped sharing |
| Confidential | prices, stock, supplier terms, contracts, financial records | least privilege, export controls, audit |
| Highly sensitive | credentials, identity/bank/compensation data, private document bodies | server-only or narrowly scoped; never in logs/demos/source |

## Authentication and Authorization

- Protected operations require a valid session mapped to an active employee.
- Roles, department/assignment scope, operation permission, and sensitive fields are evaluated separately.
- RLS limits database rows even if application code makes an overly broad query.
- Administrative technical access does not automatically grant business approval authority.
- Temporary or elevated grants require expiry and auditability.

### Permission Center V2

The configurable access catalog supplements the fixed compatibility roles. A
grant combines a stable permission code, allow/deny effect, data scope, and
field-access level. Explicit deny takes precedence when effective permissions
are explained. System roles remain read-only in the V2 editor; custom roles are
assigned separately so the rollout can be reversed without changing existing
workflow authorization. The configuration UI is not an enforcement boundary:
database RLS and transactional RPC authorization remain canonical.

High-risk finance permissions must be separated across preparation, review,
posting, payment approval, payment execution, reconciliation, and period close.

## Secret Management

Secrets belong only in approved local/runtime secret stores. Never commit tokens, passwords, service-role keys, private certificates, production connection strings, private IPs, or real test-account credentials. Browser-visible variables must be explicitly designed for public exposure and remain protected by RLS and origin controls.

## Input, Output, and File Safety

- Validate untrusted input and constrain lengths, types, dates, amounts, and status values.
- Avoid constructing raw query/filter grammar from unchecked input.
- Escape output through framework defaults and review any rich text or downloadable content.
- Validate uploads by authorization, size, extension, MIME type, and destination.
- Proxy private downloads through server permission checks; do not publish stable private storage URLs.

## Financial and Inventory Controls

High-impact actions validate role, current state, amount/quantity bounds, and duplicate/stale versions inside a transaction. Use reversal and audit history instead of silent edits or deletion.

Bulk inventory and product-price exports require an explicit database operation
check before any export query. Successful downloads are fail-closed on audit: if
the audit event cannot be written, the application does not return the file.

## AI Security

- Retrieval inherits user permissions and sends only bounded relevant fields.
- Retrieved text is treated as data, not as trusted instructions.
- AI answers must decline unsupported or unauthorized requests.
- Current AI has no business write tools.
- Future tools require risk classification, explicit confirmation, re-authorization, idempotency, transaction safety, and immutable audit.

## Logging and Incident Handling

Logs may contain action type, safe object identifier, status, latency, and trace ID. They must not contain credentials, authorization headers, private document bodies, sensitive free text, or unnecessary personal data. Security incidents require containment, credential rotation where relevant, impact review, recovery verification, and a recorded corrective action.

Global search and AI retrieval emit structured events containing duration,
enabled-domain count, result count, and partial-failure count. Search text,
prompts, retrieved content, credentials, and authorization headers are excluded.

## Security Review Checklist

Review positive and negative authorization paths, RLS, field masking, exports, uploads/downloads, logs, rate limits, dependency risk, migration rollback, AI prompt injection, and public documentation before release.
