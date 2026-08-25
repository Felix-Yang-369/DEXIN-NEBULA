# CRM

**Status:** Implemented baseline / In Progress

## Purpose

CRM maintains the customer context used by quotations, sales, fulfilment, finance, search, and AI retrieval.

## Users

Sales and service staff, department leads, finance users with a business need, executives, and administrators.

## Core Entities

Customers, customer contacts, follow-ups, legal entities, legal-entity bank accounts, ownership, classification, tags, and customer logos.

## Main Workflows

Create and classify a customer → assign an owner → maintain contacts and follow-ups → define the transacting legal entity → use the customer in a quotation/opportunity/order → review downstream history.

## Business Rules

- Customer master data is reused; downstream modules must not create parallel customer records.
- Legal entities separate commercial identity from a general customer profile.
- Status, level, ownership, and last-contact information are explicit fields.
- Sensitive commercial or settlement data is not exposed as a general contact attribute.

## Permissions

Visibility follows authenticated organization, role, and assigned data scope. Create/edit, sensitive fields, exports, and organization-wide access require server authorization; UI visibility alone is insufficient.

## Data Dependencies

Organization, employees, departments, roles, sales quotations, opportunities, orders, finance documents, and audit records.

## Integrations

Current integrations are internal links to Sales, OMS, Finance, Search, BI, and the AI retrieval layer. Bulk import and external CRM synchronization are not confirmed as implemented.

## AI Integration

Implemented read-only retrieval can locate authorized customer summaries and cite them as sources. The model must not infer missing contacts, prices, relationships, or financial status.

## Current Limitations

Duplicate detection, merge governance, mature bulk import, configurable scoring, and comprehensive customer-activity analytics are incomplete.

## Future Work

Add duplicate review/merge, import validation, lifecycle metrics, configurable customer health, and stronger cross-module timelines after data ownership is agreed.
