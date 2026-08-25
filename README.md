# DEXIN NEBULA

> **AI-Native Enterprise Management Platform**

CRM · Sales · OMS · Procurement · WMS · Finance · HRM · OA · BI · AI

A modular enterprise platform connecting operational workflows, structured business data, permission-aware search, and grounded AI assistance.

[English](./README.md) | [简体中文](./README.zh-CN.md)

[Architecture](./docs/ARCHITECTURE.md) · [Documentation](./docs/README.md) · [Demo](./docs/portfolio/DEMO_GUIDE.md) · [Case Study](./docs/portfolio/CASE_STUDY.md)

## Overview

DEXIN NEBULA is designed for internal enterprise teams whose customer, order, inventory, finance, people, and document workflows are fragmented across spreadsheets and disconnected tools. It combines shared master data, auditable state transitions, database-enforced authorization, and cross-module workflows in a modular full-stack application. Its AI layer is grounded in authorized enterprise records: the implemented assistant retrieves bounded context, cites sources, and remains read-only, while controlled agent actions are a planned research direction.

## Core Modules

| Module | Purpose | Status |
| --- | --- | --- |
| [CRM](./docs/modules/CRM.md) | Customer, contact, legal-entity, and relationship management | Implemented baseline |
| [Sales](./docs/modules/SALES.md) | Opportunities, quotations, products, and commercial workflows | Implemented baseline |
| [OMS](./docs/modules/OMS.md) | Order lifecycle, fulfilment, delivery, and receivable hand-off | Implemented baseline |
| [Procurement](./docs/modules/PROCUREMENT.md) | Supplier, request, order, receiving, and payable workflows | Implemented baseline |
| [WMS](./docs/modules/WMS.md) | Batch inventory, movements, transfers, stocktakes, and outbound execution | Implemented baseline |
| [Finance](./docs/modules/FINANCE.md) | Receivables, payables, settlement, cash, invoices, and analysis | In progress |
| [HRM](./docs/modules/HRM.md) | Organization, employee lifecycle, attendance, leave, and performance | In progress |
| [OA](./docs/modules/OA.md) | Approvals, announcements, reports, documents, notifications, and audit | Implemented baseline |
| [BI](./docs/modules/BI.md) | Permission-aware operational and management analytics | In progress |

## Why AI-Native

| Capability | Status | Current boundary |
| --- | --- | --- |
| Enterprise-aware assistant | Implemented | Authenticated conversations with safe failure handling |
| Permission-aware retrieval | Implemented | Bounded structured records, published knowledge, and document metadata |
| Grounded answers | Implemented | Source references and explicit insufficient-evidence behavior |
| Intent routing and observability | Implemented baseline | Deterministic domain routing, retrieval audit, latency, and model usage |
| Semantic retrieval and evaluation | In progress | Benchmark methodology exists; measured results are pending |
| Tool calling and planning | Planned | Governed tool schemas and inspectable plans are not current capabilities |
| Human-approved workflow actions | Planned | Future writes require confirmation, re-authorization, transactions, and audit |

See [AI Architecture](./docs/AI_ARCHITECTURE.md) and [Evaluation](./docs/EVALUATION.md).

## Architecture Preview

~~~mermaid
flowchart TD
  U[Authenticated user] --> UI[Next.js / React interface]
  UI --> APP[Application layer]
  APP --> MOD[Enterprise modules]
  MOD --> CRM[CRM / Sales / OMS]
  MOD --> SCM[Procurement / WMS]
  MOD --> OPS[Finance / HRM / OA / BI]
  CRM & SCM & OPS --> DATA[(PostgreSQL + Row Level Security)]
  UI --> AI[AI assistant]
  AI --> RET[Intent routing + authorized retrieval]
  RET --> DATA
  RET --> MODEL[Language model]
  MODEL --> AI
~~~

The current system is a modular monolith. Critical order, stock, finance, and approval effects use server validation and transactional database operations. Detailed views are in [Software Architecture](./docs/ARCHITECTURE.md), [Public Architecture](./docs/portfolio/PUBLIC_ARCHITECTURE.md), and [Architecture Decisions](./docs/DECISIONS.md).

## Technology Stack

| Area | Materially used technologies |
| --- | --- |
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Base UI, Recharts |
| Backend | Next.js Server Actions and Route Handlers, Zod validation |
| Database and identity | PostgreSQL, Supabase Auth, Supabase SSR/JS, Row Level Security, SQL migrations |
| AI | Server-side language-model integration, deterministic intent routing, permission-aware RAG |
| Files and exports | Private server-mediated file storage, ExcelJS |
| Testing | ESLint, TypeScript, Node test runner, production builds |
| Deployment | Node.js service behind a TLS reverse proxy; environment-specific managed services |

## Engineering and Research Focus

The project explores modular enterprise architecture, relational workflow modeling, layered authorization, transaction consistency, permission-aware retrieval, grounded AI behavior, tool-selection accuracy, human-agent collaboration, and long-horizon agent reliability. These are engineering and research questions; DEXIN NEBULA is not presented as published academic research.

Reusable agent interfaces, retrieval utilities, workflow primitives, evaluation tools, and generic UI components may later be extracted into independent repositories after dependency, security, and ownership review. They are not automatically open-sourced or relicensed with this repository.

## Product Preview

Public screenshots are withheld until a fully synthetic dataset and privacy review are complete. The [Demo Guide](./docs/portfolio/DEMO_GUIDE.md) defines a safe demonstration sequence for Dashboard, CRM, orders, procurement, warehouse, approvals, search, AI, and audit behavior.

## Project Status

**Status: Active Development — internal alpha and business validation.**

- **Implemented:** core module pages and data models, layered authorization, major sales/procurement/inventory/approval workflows, global search, and read-only grounded AI.
- **In progress:** operational acceptance, advanced finance boundaries, returns and exceptions, retrieval evaluation, observability, and synthetic public demonstration assets.
- **Planned:** governed agent tools, human-approved write workflows, semantic retrieval, reusable analytical read models, and controlled automation.

See the [Milestone Roadmap](./docs/ROADMAP.md).

## Security and Privacy

The design combines authenticated server operations, scoped data access, PostgreSQL row-level policies, private file mediation, validation, transaction controls, and audit records. Repository documentation and public demonstrations must not expose real enterprise/personnel data, credentials, confidential financial figures, or private infrastructure. Synthetic data is required for public presentation.

## Documentation

- [Project Overview](./docs/PROJECT.md)
- [Product Requirements](./docs/PRD.md)
- [System Architecture](./docs/ARCHITECTURE.md)
- [AI Architecture](./docs/AI_ARCHITECTURE.md)
- [Roadmap](./docs/ROADMAP.md)
- [Engineering Decisions](./docs/DECISIONS.md)
- [Evaluation](./docs/EVALUATION.md)
- [Case Study](./docs/portfolio/CASE_STUDY.md)

## License & Source Availability

DEXIN NEBULA is a proprietary software project.

This repository is intended primarily for technical documentation, architectural demonstration, portfolio presentation, and evaluation. Selected components may be made publicly available, while production source code, business logic, enterprise data, credentials, and security-sensitive implementation details remain private.

Unless otherwise stated, the contents of this repository are **All Rights Reserved**. Some independent components derived from the project may be released separately under open-source licenses such as Apache-2.0. See [LICENSE](./LICENSE) and [Third-Party Notices](./THIRD_PARTY_NOTICES.md).

## Attribution

Copyright © 2026 Felix Yang / DEXIN NEBULA. Product names and records shown in public materials must be synthetic or explicitly approved for publication.
