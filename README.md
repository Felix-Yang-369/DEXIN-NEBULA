<p align="center">
  <a href="https://nebula.dexinmiaosheng.cn">
    <img src="./docs/assets/readme-hero.svg" width="100%" alt="DEXIN NEBULA — AI-native enterprise management platform" />
  </a>
</p>

<p align="center">
  <a href="./docs/ROADMAP.md"><img alt="Status: Active Development" src="./docs/assets/badges/status.svg" /></a>
  <a href="./LICENSE"><img alt="License: Proprietary" src="./docs/assets/badges/license.svg" /></a>
  <a href="./docs/README.md"><img alt="Documentation: Complete Baseline" src="./docs/assets/badges/docs.svg" /></a>
  <a href="./docs/engineering/TESTING.md"><img alt="Quality: Checks Passing" src="./docs/assets/badges/quality.svg" /></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://nebula.dexinmiaosheng.cn"><img src="./docs/assets/icons/website.svg" width="18" alt="" /> Website</a> ·
  <a href="./docs/ARCHITECTURE.md"><img src="./docs/assets/icons/architecture.svg" width="18" alt="" /> Architecture</a> ·
  <a href="./docs/README.md"><img src="./docs/assets/icons/documentation.svg" width="18" alt="" /> Documentation</a> ·
  <a href="./docs/portfolio/DEMO_GUIDE.md"><img src="./docs/assets/icons/demo.svg" width="18" alt="" /> Demo</a> ·
  <a href="./docs/portfolio/CASE_STUDY.md"><img src="./docs/assets/icons/case-study.svg" width="18" alt="" /> Case Study</a>
</p>

## Overview

DEXIN NEBULA is designed for internal enterprise teams whose customer, order, inventory, finance, people, and document workflows are fragmented across spreadsheets and disconnected tools. It combines shared master data, auditable state transitions, database-enforced authorization, and cross-module workflows in a modular full-stack application. Its AI layer is grounded in authorized enterprise records: the implemented assistant retrieves bounded context, cites sources, and remains read-only, while controlled agent actions are a planned research direction.

## At a Glance

<table>
  <tr>
    <td width="25%"><img src="./docs/assets/icons/architecture.svg" width="28" alt="" /><br /><strong>Architecture</strong><br />Modular monolith with explicit domain boundaries</td>
    <td width="25%"><img src="./docs/assets/icons/security.svg" width="28" alt="" /><br /><strong>Data & Security</strong><br />PostgreSQL, RLS, transactions, and audit</td>
    <td width="25%"><img src="./docs/assets/icons/ai.svg" width="28" alt="" /><br /><strong>AI Layer</strong><br />Permission-aware retrieval with cited evidence</td>
    <td width="25%"><img src="./docs/assets/icons/website.svg" width="28" alt="" /><br /><strong>Delivery</strong><br />Internal alpha · <a href="https://nebula.dexinmiaosheng.cn">Project website</a></td>
  </tr>
</table>

## Core Modules

<table>
  <tr>
    <td width="33%" align="center"><img src="./docs/assets/icons/customers.svg" width="40" alt="" /><br /><strong>Customer & Revenue</strong><br /><a href="./docs/modules/CRM.md">CRM</a> · <a href="./docs/modules/SALES.md">Sales</a> · <a href="./docs/modules/OMS.md">OMS</a><br /><sub>Customer context through order fulfilment</sub></td>
    <td width="33%" align="center"><img src="./docs/assets/icons/supply-chain.svg" width="40" alt="" /><br /><strong>Supply Chain</strong><br /><a href="./docs/modules/PROCUREMENT.md">Procurement</a> · <a href="./docs/modules/WMS.md">WMS</a><br /><sub>Supplier, receiving, inventory, and execution</sub></td>
    <td width="34%" align="center"><img src="./docs/assets/icons/operations.svg" width="40" alt="" /><br /><strong>Operations & Intelligence</strong><br /><a href="./docs/modules/FINANCE.md">Finance</a> · <a href="./docs/modules/HRM.md">HRM</a> · <a href="./docs/modules/OA.md">OA</a> · <a href="./docs/modules/BI.md">BI</a><br /><sub>Finance, people, collaboration, and analytics</sub></td>
  </tr>
</table>

<details>
<summary><strong>View module status and scope</strong></summary>

| Module | Purpose | Status |
| --- | --- | --- |
| CRM | Customer, contact, legal-entity, and relationship management | Implemented baseline |
| Sales | Opportunities, quotations, products, and commercial workflows | Implemented baseline |
| OMS | Order lifecycle, fulfilment, delivery, and receivable hand-off | Implemented baseline |
| Procurement | Supplier, request, order, receiving, and payable workflows | Implemented baseline |
| WMS | Batch inventory, movements, transfers, stocktakes, and outbound execution | Implemented baseline |
| Finance | Receivables, payables, settlement, cash, invoices, and analysis | In progress |
| HRM | Organization, employee lifecycle, attendance, leave, and performance | In progress |
| OA | Approvals, announcements, reports, documents, notifications, and audit | Implemented baseline |
| BI | Permission-aware operational and management analytics | In progress |

</details>

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

## Developer Quick Start

<p><img src="./docs/assets/icons/terminal.svg" width="28" alt="" /> <strong>Local development requires Node.js 22 LTS and npm 10 or later.</strong></p>

~~~bash
npm ci
cp .env.example .env.local
npm run dev
~~~

Use development-only credentials and synthetic data. Run `npm run check`, `npm run test:workflow`, and `npm run build` before a release. See the [Development Guide](./docs/engineering/DEVELOPMENT.md) for environment, database, and workflow conventions.

## Engineering and Research Focus

The project explores modular enterprise architecture, relational workflow modeling, layered authorization, transaction consistency, permission-aware retrieval, grounded AI behavior, tool-selection accuracy, human-agent collaboration, and long-horizon agent reliability. These are engineering and research questions; DEXIN NEBULA is not presented as published academic research.

Reusable agent interfaces, retrieval utilities, workflow primitives, evaluation tools, and generic UI components may later be extracted into independent repositories after dependency, security, and ownership review. They are not automatically open-sourced or relicensed with this repository.

## Product Preview

The public [project website](https://nebula.dexinmiaosheng.cn) presents the product at a high level. Repository screenshots remain withheld until a fully synthetic dataset and privacy review are complete. The [Demo Guide](./docs/portfolio/DEMO_GUIDE.md) defines a safe demonstration sequence for Dashboard, CRM, orders, procurement, warehouse, approvals, search, AI, and audit behavior.

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

<table>
  <tr>
    <td width="33%"><strong>Proprietary product</strong><br />DEXIN NEBULA is distributed under an All Rights Reserved proprietary license.</td>
    <td width="33%"><strong>Controlled source availability</strong><br />The repository supports documentation, portfolio review, demonstration, and evaluation. Access does not grant reuse rights.</td>
    <td width="34%"><strong>Independent components</strong><br />Selected generic components may be extracted and licensed separately after ownership and security review.</td>
  </tr>
</table>

Production source, business logic, enterprise data, credentials, and security-sensitive implementation details remain private. See the full [Proprietary License](./LICENSE) and [Third-Party Notices](./THIRD_PARTY_NOTICES.md).

## Attribution

Copyright © 2026 Felix Yang / DEXIN NEBULA. Product names and records shown in public materials must be synthetic or explicitly approved for publication.
