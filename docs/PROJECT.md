# Project Overview

**Status:** In Progress (internal alpha)

## Motivation

DEXIN NEBULA investigates how one permission-aware platform can replace fragmented operational records with connected workflows, traceable decisions, and grounded AI assistance. The engineering motivation is to build a realistic full-stack system in which authorization, transactions, retrieval, and usability are treated as one design problem.

## Problem Statement

When customer, order, stock, finance, employee, and document records live in separate tools, users duplicate data, lose workflow context, and struggle to answer cross-functional questions. Conventional chat assistants add little value if they cannot respect enterprise permissions or cite the records behind an answer.

## Target Users

- Employees completing routine work and requests
- Department leads reviewing team work and approvals
- Sales, procurement, warehouse, finance, and HR specialists
- Executives reviewing authorized operational summaries
- Administrators managing identities, roles, and audit visibility

## User Scenarios

- Convert a customer opportunity and quotation into an order, fulfilment record, and receivable.
- Convert an approved purchase request into receiving, inventory, and a payable.
- Track employee lifecycle tasks and approval history.
- Find an authorized record through global search or ask the AI assistant for a source-grounded explanation.
- Review operational indicators without manufacturing data when evidence is absent.

## Project Goals

1. Maintain shared master data across enterprise modules.
2. Make critical state transitions transactional and auditable.
3. Enforce page, operation, row, and sensitive-field permissions.
4. Provide reliable search and read-only AI retrieval over authorized data.
5. Keep the system understandable, testable, and incrementally deployable.

## Scope

The current scope includes CRM, sales, order management, procurement, warehouse management, finance operations, HRM, OA, BI, search, documents, notifications, audit, and a retrieval-augmented AI assistant. It serves a single internal organization and authenticated users.

## Out of Scope

- Public self-service registration or a complete multi-tenant SaaS platform
- Full statutory accounting, tax filing, payroll, or replacement of mature accounting suites
- Unsupervised AI writes, approvals, payments, or destructive actions
- Claims of predictive analytics without validated data and evaluation

## Core Capabilities

Capabilities are organized around shared master data, transactional business flows, role-aware interfaces, PostgreSQL row-level security, versioned migrations, document metadata and private storage, operational dashboards, global search, and grounded AI answers. Module details are indexed in [Documentation](./README.md).

## Constraints

- Sensitive business and personnel data require least-privilege access.
- Some external integrations depend on separately managed environments.
- Business data volume and process maturity are still growing.
- The application must provide useful empty and failure states instead of synthetic operational claims.
- Schema changes must remain compatible with an auditable migration history.

## Success Metrics

The target measures are workflow completion, authorization correctness, transaction consistency, error rate, response latency, retrieval quality, AI groundedness, and operator recovery time. Baselines are not yet complete; measurement design is defined in [Evaluation](./EVALUATION.md).

## Major Technical Challenges

- Coordinating inventory and finance effects across module boundaries
- Enforcing authorization consistently from UI to database
- Retrieving useful enterprise context without exposing unauthorized fields
- Separating management estimates from formal accounting facts
- Maintaining a broad modular application without duplicating shared capabilities

## Current Status

Core module pages, data models, server operations, RLS policies, transactional workflows, workflow tests, global search, and a read-only AI retrieval path are implemented. Operational acceptance, broader integration testing, advanced finance, complex returns, and AI evaluation remain in progress.

## Future Directions

Future work includes stronger observability, measurable service objectives, controlled AI tools with explicit human confirmation, improved retrieval, workflow configuration, additional integration adapters, and decision-support features backed by validated data.
