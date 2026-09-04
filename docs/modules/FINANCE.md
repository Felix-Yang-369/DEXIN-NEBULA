# Finance

**Status:** Implemented operational baseline / Accounting kernel V4 close-control foundation

## Purpose

Finance provides operational receivable/payable tracking, settlement, cash documents, invoices, vouchers, aging, and management views connected to source workflows.

The accounting kernel V4 adds a parallel formal-accounting foundation with
books, fiscal periods, a chart of accounts, balanced multi-line journal entries,
segregated review, immutable posting, controlled reversal, period governance,
trial balance, account-detail ledgers, controlled opening-balance migration,
profit-and-loss closing entries, a month-end checklist, controlled reopening,
comparative financial statements, and account-ledger drilldown. Legacy
operational vouchers remain in place until each source workflow is migrated and
reconciled.

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

P2 的固定资产、折旧、预算、费用入账关联和税务辅助台账已建立数据基础；写入与凭证生成仍须在后续批次通过受控事务函数和实际账套验收后开放。监管格式报表、自动银行匹配、税务申报、薪酬核算、存货成本、合并报表及完整业财规则仍不属于当前交付基线。

## Accounting Kernel Controls

- Every journal contains at least two lines and must balance before it is stored.
- Only active posting accounts in the selected book may be used.
- Entry dates must belong to an open fiscal period.
- The creator cannot review or post their own entry; reviewed entries require a separate posting transition.
- Posted entries and lines are immutable and must later be corrected through linked reversal entries.
- Reversal creates and posts an opposite entry in an open period; the original entry and audit trail remain intact.
- Periods open and close in chronological order; closing is blocked while draft or reviewed entries remain.
- Reopening is restricted by an explicit permission and proceeds from the latest closed period backward. It creates a linked reversal draft and keeps the period in `reopening` until a different employee reviews and posts the reversal.
- Trial balance and account ledgers include only posted and reversed accounting entries.
- Opening balances can be generated only before any other non-void entry exists in the fiscal year. They are saved as a draft, require normal review/posting, and cannot use the ordinary reversal path.
- Period closing produces a draft entry that clears posted profit-and-loss balances into the current-year-profit account. The period cannot close until this entry is posted.
- Closing is blocked by unbalanced entries, unposted entries, an unposted profit-and-loss close entry, or period-order violations. Bank reconciliation, cash-flow classification, and counterparty differences are warnings that require a current written acknowledgement.
- Posting the controlled closing reversal automatically opens the period, preserves the original close and reversal entries, and increments the close version. Re-closing creates a new close entry instead of overwriting history.
- Balance sheet, income statement, and cash-flow views use posted accounting entries only. The cash-flow view keeps ambiguous or missing classifications visible as unclassified rather than inferring a formal category.
- Statements provide equal-length prior-period and prior-year comparisons. Account rows link to the account-detail ledger, whose entries link to their vouchers.
- Cash-flow account rules can only be changed through a permission-checked database function and every change is audited.
- Server actions are entry points only; the database functions re-check identity, organization, role, period, account, balance, version, and state.

## Future Work

Add governed report-line mappings, cash-flow manual classification at voucher level, auxiliary ledgers, reconciliation assistance, external accounting exchange, and formal separation of operational versus statutory accounting.
