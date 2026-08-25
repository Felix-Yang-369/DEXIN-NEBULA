# Human Resource Management (HRM)

**Status:** Implemented baseline / In Progress

## Purpose

HRM maintains organization and employee records and supports attendance, leave, lifecycle, job structure, and performance workflows under strict privacy controls.

## Users

Employees, department leads, HR specialists, authorized executives, and administrators.

## Core Entities

Organizations, departments, employees, HR profiles, contracts, employment status changes, lifecycle cases/tasks, job levels, positions, attendance/leave usage and balances, and performance plans/metrics.

## Main Workflows

Maintain organization/job structure → onboard employee and identity → manage employment/contract changes → record attendance and leave → manage performance plan → complete offboarding checklist and retain authorized history.

## Business Rules

- The employee record links authentication, organization, responsibilities, and workflow identity.
- Employment status changes are historical events, not destructive profile replacement.
- Leave requests follow an explicit approval state machine and authorized approver assignment.
- Contracts, identity, bank, compensation, and private contact data are sensitive.

## Permissions

Employees see permitted self-service data; leads see granted team scope; HR and executives receive explicitly defined company scope; administrators do not automatically become business approvers. Sensitive fields require field-level control.

## Data Dependencies

Authentication identities, departments, roles, approvals, notifications, audit, OA, BI, and assignment fields across business modules.

## Integrations

Implemented internal links include identity, approvals, attendance, OA, BI, Search, and AI retrieval. Enterprise identity and small-program login are environment-dependent. Payroll, recruitment, and training platforms are not complete integrations.

## AI Integration

The read-only assistant may retrieve a limited authorized employee directory context. It must not reveal private HR fields, infer performance, or compare employees beyond the user's scope.

## Current Limitations

Full payroll, recruitment, training, workforce planning, mature work-calendar rules, and comprehensive compensation governance are incomplete or out of scope.

## Future Work

Strengthen lifecycle automation, privacy reviews, configurable calendars, performance evidence, retention rules, and approved HR integrations.
