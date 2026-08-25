# Sales Management

**Status:** Implemented baseline / In Progress

## Purpose

Sales Management supports pre-order revenue work: opportunities, quotations, product/price selection, and commercial hand-off to an order.

## Users

Sales staff, sales leads, authorized finance reviewers, executives, and administrators.

## Core Entities

Sales opportunities, quotations, quotation items, quotation status events, customers, customer legal entities, products, product prices, payment terms, and delivery terms.

## Main Workflows

Qualify opportunity → select customer and legal entity → build quotation from products and authorized prices → review and update status → print/share approved representation → create or associate an order.

## Business Rules

- Quotation lines preserve commercial snapshots so later master-data changes do not silently rewrite history.
- Users may only view price types allowed by their role.
- Status changes are recorded; invalid transitions are rejected.
- Quotation values and estimated profitability are commercial estimates, not statutory accounting results.

## Permissions

Customer scope and role determine access. Price, margin, organization-wide pipeline, editing, and export/print operations require explicit authorization.

## Data Dependencies

CRM, customer legal entities, product master, product prices, employees, OMS, audit, search, and BI.

## Integrations

Implemented internal integration includes CRM, Product Management, OMS, global search, and AI retrieval. Electronic signature and a final external PDF workflow are not confirmed.

## AI Integration

The current read-only layer can retrieve authorized quotation metadata and related customer context. It must distinguish an offer from an accepted order and must not expose hidden price classes.

## Current Limitations

Formal PDF templates, electronic signature, complex discount approval, forecast governance, and opportunity-to-order analytics are incomplete.

## Future Work

Add configurable commercial approval, version comparison, approved templates, forecast evaluation, and clearer conversion metrics.
