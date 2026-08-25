# Milestone Roadmap

Roadmap status reflects repository evidence, not a release promise.

## Phase 1 — Foundation

- **Objective:** establish identity, organization, permissions, shared UI, migrations, audit primitives, and deployment checks.
- **Deliverables:** authenticated application shell; employee/department/role model; RLS; approval, notification, and audit foundations; automated check commands.
- **Status:** Implemented baseline; operational hardening continues.
- **Dependencies:** managed authentication/database environment and role assignments.
- **Success criteria:** protected routes reject unauthorized access; schema is reproducible from migrations; critical workflows are testable.

## Phase 2 — Core Enterprise Modules

- **Objective:** connect revenue, supply-chain, finance, people, and collaboration records.
- **Deliverables:** CRM, quotations, sales orders, procurement, WMS, finance operations, HRM, OA, BI, documents, and exports.
- **Status:** Implemented baseline / In Progress.
- **Dependencies:** validated master data, business rule ownership, representative acceptance data.
- **Success criteria:** sales-to-cash and procure-to-pay scenarios complete without inconsistent stock or balances; role acceptance passes.

## Phase 3 — AI Integration

- **Objective:** provide safe discovery and grounded explanations over authorized enterprise data.
- **Deliverables:** global search, authenticated AI conversations, intent routing, bounded retrieval, source citations, usage/audit records, safe degradation.
- **Status:** Implemented baseline; evaluation and retrieval quality are In Progress.
- **Dependencies:** data quality, permission coverage, model configuration, curated evaluation cases.
- **Success criteria:** benchmarked retrieval quality and groundedness meet human-approved targets; no unauthorized disclosure in adversarial tests.

## Phase 4 — Agentic Workflows

- **Objective:** support narrowly scoped, human-approved actions without losing control or traceability.
- **Deliverables:** tool registry, risk classes, plan preview, explicit confirmation, server re-authorization, idempotent execution, audit replay.
- **Status:** Planned.
- **Dependencies:** stable APIs, complete authorization tests, observability, rollback semantics, owner-approved risk policy.
- **Success criteria:** sandbox evaluation demonstrates correct tool choice and safe refusal; every effect is confirmed, authorized, transactional, and auditable.

## Phase 5 — Intelligence and Automation

- **Objective:** turn reliable operational history into measurable decision support and controlled automation.
- **Deliverables:** validated read models, anomaly signals, process analytics, configurable automation, cost/quality governance.
- **Status:** Planned.
- **Dependencies:** sufficient historical data, agreed metric definitions, data-quality monitoring, Phase 4 controls.
- **Success criteria:** decision-support metrics are reproducible, owners accept their definitions, and automation improves cycle time without increasing control failures.

## Immediate Priorities

1. Complete role-based operational acceptance with synthetic or approved test data.
2. Measure page, workflow, search, and AI baselines defined in [Evaluation](./EVALUATION.md).
3. Close complex return/change and finance boundary gaps before expanding breadth.
4. Review documentation and demo assets for public-safe presentation.
