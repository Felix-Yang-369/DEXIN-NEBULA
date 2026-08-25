# Business Intelligence (BI)

**Status:** Implemented baseline / In Progress

## Purpose

BI presents permission-aware operational summaries without fabricating trends when source data is missing or immature.

## Users

Executives, department leads, finance and operations specialists, and other users with scoped dashboard access.

## Core Entities

BI primarily uses derived views of customers, sales orders, inventory, receivables/payables, organization headcount, approvals, and source-record coverage. It is not a separate source of truth.

## Main Workflows

Select authorized dashboard → apply filters/time scope → inspect KPI and distribution → navigate to source module → verify details and take action in the owning module.

## Business Rules

- Every metric requires a defined source, filter, time range, and aggregation rule.
- Empty or insufficient data is shown explicitly; synthetic operational trends are prohibited.
- Estimated margin, cash movement, receivable, and accounting profit are different measures.
- Drill-down permissions cannot exceed the source module's authorization.

## Permissions

Dashboard visibility, company scope, financial indicators, and sensitive profitability measures are restricted by role and source-level policy.

## Data Dependencies

CRM, Sales/OMS, Procurement, WMS, Finance, HRM, approvals, and shared organization/time dimensions.

## Integrations

BI reads internal application/database data and links back to source modules. A standalone warehouse, semantic layer, or external analytics platform is not confirmed as implemented.

## AI Integration

Current AI can explain retrieved authorized records, but a governed natural-language semantic metrics layer is not implemented. It must not invent metric definitions or trends.

## Current Limitations

Historical data volume, formal metric ownership, trend baselines, data-quality monitoring, cohort analysis, and a reusable semantic layer are incomplete.

## Future Work

Define metric contracts and owners, build tested read models, monitor freshness/completeness, add drill-down evaluation, and expose selected metrics to AI only after semantic validation.
