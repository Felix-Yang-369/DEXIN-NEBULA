# Sales Management

**Status:** Implemented sales-to-cash V2 foundation

## Purpose

Sales Management supports opportunities, quotations, product/price selection, approval-gated orders, partial warehouse fulfillment, delivery hand-off, and receivable generation.

## Users

Sales staff, sales leads, authorized finance reviewers, executives, and administrators.

## Core Entities

Sales opportunities, quotations, sales orders and lines, approval instances, outbound batches, deliveries, receivable documents, settlements, customers, legal entities, products, prices, payment terms, and delivery terms.

## Main Workflows

Qualify opportunity → create order → resolve confirmation approval → approve → fulfill one or more warehouse batches → create one receivable per outbound batch → settle and trace the chain from order to cash.

## Business Rules

- Quotation lines preserve commercial snapshots so later master-data changes do not silently rewrite history.
- Users may only view price types allowed by their role.
- Status changes are recorded; invalid transitions are rejected.
- Sales staff cannot directly confirm an order. V2 resolves the approval route from the active workflow definition and only an approved request moves the order to confirmed.
- Fulfillment quantities cannot exceed each order line's remaining quantity or warehouse availability.
- Every completed outbound batch creates a linked receivable for that batch's delivered value; partial fulfillment keeps the order in `fulfilling` until every line is delivered.
- The order trace read model exposes approval, outbound, receivable, due, and settled state only after order-level authorization.
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

Returns/refunds, receivable reversal after outbound cancellation, allocation across multiple inventory rows, tax-aware line pricing, formal PDF templates, electronic signature, forecast governance, and opportunity-to-order analytics remain incomplete.

## Future Work

Add configurable commercial approval, version comparison, approved templates, forecast evaluation, and clearer conversion metrics.
