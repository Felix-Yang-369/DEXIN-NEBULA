# Warehouse Management System (WMS)

**Status:** Implemented baseline / In Progress

## Purpose

WMS maintains warehouse stock, batch traceability, and controlled inventory execution for receiving, outbound fulfilment, transfer, and stocktake.

## Users

Warehouse staff, procurement and sales operations, authorized finance users, managers, and administrators.

## Core Entities

Warehouses, inventory items, inventory batches, inventory movements, outbound orders/items, transfers, stocktakes/items, import records, and delivery records.

## Main Workflows

Receive goods into batch stock; inspect on-hand, reserved, quarantined, and available quantities; fulfil outbound demand; transfer between locations; perform stocktake adjustments; export authorized inventory views.

## Business Rules

- Available stock must be distinguished from physical, reserved, and quarantined quantities.
- Outbound execution cannot exceed valid available stock.
- Batch/expiry information is preserved where applicable.
- Transfers and stocktake adjustments create traceable movements rather than overwriting history.
- Critical multi-record updates execute transactionally.

## Permissions

Read, execute, adjust, import, and export permissions are separate. Sensitive cost or company-wide stock views require an authorized role. Database and server checks enforce scope.

## Data Dependencies

Products, warehouses, procurement receipts, sales orders, deliveries, employees, finance source records, and audit events.

## Integrations

Implemented internal links include Procurement, OMS, Product Management, Finance, BI, Search, and AI retrieval. Scanner, carrier, and third-party warehouse connectors are planned.

## AI Integration

Read-only AI retrieval can explain authorized inventory snapshots and must state the quantity type and time context. It cannot reserve, release, transfer, or adjust stock.

## Current Limitations

Barcode execution, advanced allocation, wave/pick/pack workflows, third-party WMS synchronization, and a mature stocktake orchestration experience are incomplete.

## Future Work

Add scan-first operations, exception queues, replenishment rules, stronger batch allocation, integration adapters, and measured inventory accuracy.
