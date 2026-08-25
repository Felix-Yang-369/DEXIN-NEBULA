# Order Management System (OMS)

**Status:** Implemented baseline / In Progress

## Purpose

OMS manages confirmed sales orders and coordinates fulfilment effects across warehouse, delivery, receivables, and audit history.

## Users

Sales operations, warehouse staff, finance users, department leads, executives, and administrators.

## Core Entities

Sales orders, order items, order events, profitability snapshots, customer legal entities, outbound orders/items, delivery records, inventory movements, receivables, and invoices.

## Main Workflows

Create order → validate customer legal entity and lines → confirm → check available stock → create outbound fulfilment and delivery → post inventory movement → create receivable/invoice records where applicable → collect and allocate cash.

## Business Rules

- Confirmation requires a valid customer legal entity.
- Fulfilment checks current state and available inventory.
- Cross-table effects are performed transactionally to prevent partial stock or finance updates.
- Cancellation is state-dependent; confirmed historical effects cannot be silently erased.
- Estimated profitability is access-controlled and is not formal accounting profit.

## Permissions

Order creation and visibility follow sales scope. Confirmation, fulfilment, cancellation, financial fields, and organization-wide views require role-specific authorization and database enforcement.

## Data Dependencies

CRM, Sales, products, warehouses, inventory batches, delivery, finance documents, invoices, employees, audit, and notifications.

## Integrations

OMS integrates internally with CRM, Sales, WMS, Finance, BI, Search, and AI retrieval. Third-party logistics or marketplace connectors are not implemented as a general integration layer.

## AI Integration

Current AI can retrieve authorized order-related structured context only where included in the governed retrieval scope. It is not allowed to confirm, cancel, fulfil, or modify orders.

## Current Limitations

Complex order amendments, returns/refunds, partial fulfilment exception management, carrier integration, and formal realized-margin posting are incomplete.

## Future Work

Design versioned amendments, return merchandise authorization, exception queues, idempotent external fulfilment adapters, and reconciled realized-margin reporting.
