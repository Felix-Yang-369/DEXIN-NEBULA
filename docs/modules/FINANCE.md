# Finance

**Status:** Implemented operational baseline / In Progress

## Purpose

Finance provides operational receivable/payable tracking, settlement, cash documents, invoices, vouchers, aging, and management views connected to source workflows.

## Users

Finance specialists, authorized executives, selected business owners, auditors/administrators within granted scope.

## Core Entities

Finance documents, vouchers, settlements, cash documents and allocations, invoices, bank statement lines, bank reconciliations, source orders/receipts, and customer legal entities.

## Main Workflows

Create open item from fulfilment or receipt → review aging/balance → import or record cash evidence → allocate receipt/payment → update outstanding balance and settlement state → generate traceable voucher/invoice records → export authorized reports.

## Business Rules

- Sales confirmation is not revenue recognition; the current receivable is created from fulfilment.
- Purchase-order creation is not payable recognition; the current payable is created from receipt.
- Allocation cannot exceed the remaining open amount or produce a negative balance.
- Reversal follows a controlled workflow; settled source amounts cannot be silently rewritten.
- Management estimates and formal accounting values must remain distinguishable.

## Permissions

Finance pages, exports, bank/cash records, sensitive amounts, and profitability are restricted to authorized roles and data scopes. High-impact writes are validated server-side and recorded.

## Data Dependencies

CRM legal entities, OMS fulfilment, Procurement receiving, employees/roles, invoices, audit, and BI.

## Integrations

Internal integration connects OMS, Procurement, WMS, BI, Search, exports, and AI retrieval. Automated bank feeds, tax systems, and full accounting-suite synchronization are not implemented as complete production integrations.

## AI Integration

Read-only retrieval may provide authorized finance summaries with source and time context. It must not infer accounting conclusions, compare employees/customers outside scope, post vouchers, allocate cash, or initiate payment.

## Current Limitations

Full general ledger, statutory reporting, tax filing, automated bank matching, budgeting, payroll accounting, and mature accounting-suite integration are outside the current baseline.

## Future Work

Improve reconciliation assistance, controlled reversals, reporting definitions, audit coverage, external accounting exchange, and formal separation of operational versus statutory accounting.
