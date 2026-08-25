# Approval, Leave, Expense, and Seal Workflows

**Status:** Implemented baseline / policy configuration In Progress

## Purpose

The shared approval foundation models requests, assigned steps, actions, events, notifications, and audit history so modules do not implement incompatible approval engines.

## Common State Model

~~~text
draft → submitted / assigned steps → approved
  └→ withdrawn
assigned step → returned → resubmitted
assigned step → rejected
~~~

Concrete status names differ where a workflow needs named business stages. The server and transactional database function validate the current state, assigned actor, action, and version. A page cannot skip a node or directly set a final state.

## Roles and Scope

- The applicant creates, submits, views, and—only when rules allow—withdraws their request.
- The current assigned approver acts only on an active step assigned to them.
- Functional reviewers such as HR or Finance act only at their configured step and data scope.
- Executives participate when an approved workflow definition assigns them.
- Administrators configure or troubleshoot the platform but do not automatically replace business approvers.

## Leave

Implemented leave requests capture type, date range, reason, handover, and exceptional-case information and route through assigned supervisory and filing/approval stages. Exact leave entitlements, calendars, evidence, escalation rules, and approver thresholds are organizational policy and are intentionally not published here.

## Expense

Implemented expense requests capture category, occurrence date, amount, counterparty/merchant summary, description, and invoice presence/count. Conditional routing supports role-based review. Numerical approval thresholds and payment policy must be configured from an approved private policy source; example values must not be treated as company policy.

## Seal Requests

Seal requests use the same governed request/step/event foundation with workflow-specific fields and assigned review. Document content and sensitive attachments require separate file authorization.

## Audit and Notifications

Each action preserves request identifier, actor, role, action, previous/next state, time, and necessary comment metadata. Notifications contain only the minimum summary needed to direct the recipient. Sensitive reasons, amounts, or attachment bodies should not be copied into broad notifications or audit logs.

## Current Limitations

Visual workflow configuration, complete work calendars/leave balances, mature attachment lifecycle, expense payment state, notification preferences, and full end-to-end database integration coverage remain incomplete.

## Acceptance

Test every valid and invalid transition, stale/duplicate actions, applicant/assignee/functional/admin roles, notification recipients, audit immutability, sensitive-field scope, and transaction rollback using synthetic data.
