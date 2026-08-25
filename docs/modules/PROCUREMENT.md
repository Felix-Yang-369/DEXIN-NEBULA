# Procurement

**Status:** Implemented baseline / In Progress

## Purpose

Procurement controls supplier master data and the procure-to-pay path from business request through approval, ordering, receipt, inventory, and payable creation.

## Users

Requesters, department approvers, buyers, warehouse receivers, finance users, executives, and administrators.

## Core Entities

Suppliers, supplier contacts and qualifications, purchase requests/items, purchase orders/items, goods receipts/items, inventory batches, payables, bank statement lines, and reconciliations.

## Main Workflows

Maintain/qualify supplier → create purchase request → approve → create and confirm purchase order → record receipt and batches → create payable from actual receipt → pay and reconcile.

## Business Rules

- Supplier records are shared master data with explicit cooperation and qualification status.
- Approval precedes controlled order conversion.
- A purchase order does not itself recognize a payable; actual receipt is the current recognition event.
- Receipt, batch inventory, and payable effects must remain transactionally consistent.
- Duplicate or stale state transitions are rejected.

## Permissions

Requester, approver, procurement, warehouse, and finance duties are separated. Settlement data, qualification documents, company-wide views, and financial operations are sensitive.

## Data Dependencies

Organization, employees, roles, approvals, suppliers, products, warehouses, inventory, finance documents, cash allocation, notifications, and audit.

## Integrations

Implemented internal integration covers approvals, WMS, Finance, BI, Search, and AI retrieval. External supplier portals, EDI, and automated procurement networks are not implemented.

## AI Integration

The current assistant can retrieve authorized supplier summaries. It cannot approve requests, select a supplier, place an order, confirm receipt, or trigger payment.

## Current Limitations

Returns, versioned purchase-order changes, supplier onboarding approval, delivery exceptions, and supplier performance measurement are incomplete.

## Future Work

Add supplier admission governance, performance scorecards, amendment/return workflows, three-way matching, and exception-focused receiving.
