# Office Automation (OA)

**Status:** Implemented baseline / In Progress

## Purpose

OA provides shared collaboration capabilities: approvals, leave/expense/seal requests, announcements, weekly reports, knowledge, documents, notifications, and audit history.

## Users

All authenticated employees, assigned approvers, department leads, HR, finance, executives, content owners, and administrators.

## Core Entities

Approval requests/steps/events, leave requests/actions, expense claims, seal requests, announcements/read receipts, weekly reports, knowledge documents, business documents/folders/access requests, notifications, and audit logs.

## Main Workflows

Create request → submit → route to assigned approval steps → approve/return/reject/withdraw → notify participants → preserve immutable history. Content flows include publish/read announcements, submit weekly reports, browse knowledge, and request controlled document access.

## Business Rules

- State machines determine valid actions; pages cannot skip approval nodes.
- Approval assignments are resolved and validated server-side.
- Notifications contain the minimum necessary summary.
- Audit records preserve actor, action, object, state change, and time without copying sensitive bodies.
- Document metadata and binary access follow folder/role/department/employee grants.

## Permissions

Applicants see their records; current assignees act only on valid tasks; functional roles receive defined scopes. Administrators troubleshoot configuration but do not automatically replace business approvers.

## Data Dependencies

Authentication, employees, departments, roles, HRM, Finance, Procurement, private file storage, search, and audit.

## Integrations

Internal integration includes workflow notifications, HR leave, finance expense review, document storage, Search, and AI retrieval. External messaging delivery is not a general production capability.

## AI Integration

Read-only AI can retrieve authorized published knowledge, announcements, approval summaries, and document metadata. It cannot claim to read binary content, approve requests, or modify documents.

## Current Limitations

Visual workflow configuration, advanced forms, attachment lifecycle, notification preferences, retention policy, and broad external messaging remain incomplete.

## Future Work

Add governed workflow templates, stronger document lifecycle/recovery, notification preferences, retention rules, search indexing, and human-approved AI assistance for drafting—not approval execution.
