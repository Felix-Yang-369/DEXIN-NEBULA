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

## AI Security

- Retrieval inherits user permissions and sends only bounded relevant fields.
- Retrieved text is treated as data, not as trusted instructions.
- AI answers must decline unsupported or unauthorized requests.
- Current AI has no business write tools.
- Future tools require risk classification, explicit confirmation, re-authorization, idempotency, transaction safety, and immutable audit.

## Logging and Incident Handling

Logs may contain action type, safe object identifier, status, latency, and trace ID. They must not contain credentials, authorization headers, private document bodies, sensitive free text, or unnecessary personal data. Security incidents require containment, credential rotation where relevant, impact review, recovery verification, and a recorded corrective action.

## Security Review Checklist

Review positive and negative authorization paths, RLS, field masking, exports, uploads/downloads, logs, rate limits, dependency risk, migration rollback, AI prompt injection, and public documentation before release.
