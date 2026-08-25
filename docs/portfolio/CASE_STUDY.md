# DEXIN NEBULA Case Study

## Problem

Operational knowledge becomes unreliable when customer work, orders, stock, finance, people processes, approvals, documents, and analysis are maintained in disconnected tools. Users spend time reconciling versions and cannot safely ask cross-functional questions.

## Constraints

The system handles sensitive enterprise and personnel data, so convenience cannot replace authorization. Business workflows span multiple records and must not partially succeed. Data maturity varies, and the product must show uncertainty or empty states instead of producing impressive but false metrics. The project is developed incrementally as a modular full-stack application.

## Design

DEXIN NEBULA uses shared master data and explicit module boundaries. CRM, sales/OMS, procurement/WMS, finance, HRM/OA, and BI connect through stable identifiers and governed workflows. Authentication, row-level security, audit, notification, files, search, and AI are shared platform capabilities rather than module-specific copies.

## Engineering

The implementation combines Next.js and React with PostgreSQL/Supabase. Server Actions and Route Handlers validate application operations; RLS constrains rows; transactional database functions protect cross-module stock and finance effects. Versioned migrations make schema and permission changes reviewable. Workflow tests focus on state, amount, inventory, and authorization boundaries.

## AI

The AI layer starts from a conservative principle: enterprise assistance must be grounded and permission-aware before it becomes agentic. The implemented assistant classifies intent, retrieves bounded authorized records, provides source references, records usage, and fails safely. It is read-only. Planning and business write tools remain future research subject to confirmation, audit, and evaluation controls.

## Results

Repository evidence demonstrates a broad working alpha: module pages, shared data models, cross-module workflows, RLS migrations, document controls, global search, AI retrieval, and automated workflow checks. Business outcome metrics and formal AI benchmark results are not yet available and are not claimed.

## Lessons

- Authorization is a data architecture concern, not a navigation feature.
- A cross-module workflow is only reliable when its state and side effects are atomic.
- AI quality depends on retrieval scope, evidence, refusal, and evaluation more than chat UI.
- “No data” is a valid product state; fabricated dashboards damage trust.
- A modular monolith can support substantial scope when boundaries and shared capabilities are explicit.

## Future Questions

How should enterprise tool calls be risk-scored? Which actions benefit from AI preparation but still require human execution? When does deterministic retrieval need semantic indexing? How should source correctness and permission leakage be benchmarked? At what scale should analytics/read models or background workers be separated from the modular monolith?

All public demonstrations of this case study must use synthetic data and the sanitized architecture.
