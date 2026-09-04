# Software Architecture

**Current state:** modular full-stack application with a managed PostgreSQL backend. Planned capabilities are labelled explicitly.

## System Context

~~~mermaid
flowchart LR
  U[Authenticated employee] --> W[Next.js web application]
  W --> A[Application services]
  A --> S[Supabase Auth]
  A --> P[(PostgreSQL + RLS)]
  A --> F[Private file service]
  A --> X[Approved external services]
  A --> M[AI model service]
~~~

The browser does not connect directly to privileged credentials or private storage. Public-facing material uses synthetic data and a sanitized architecture.

## Current Architecture

### Frontend

Next.js App Router and React implement authenticated pages, server-rendered views, interactive client components, responsive navigation, forms, tables, charts, loading states, and error states. A server-owned application shell supplies authorized navigation data to narrow client islands for the three-state sidebar, mobile drawer, and command center. Tailwind CSS and shared components provide the visual system.

### Backend

The Next.js application is also the backend-for-frontend. Server Actions handle most authenticated mutations; Route Handlers support AI chat, dashboard data, authentication callbacks, downloads, exports, and a small-program authentication surface. Zod and domain services validate inputs and workflow rules.

### Database

PostgreSQL stores shared master data, workflow records, finance and inventory documents, notifications, audit events, and AI conversation metadata. Supabase provides authentication, database access, and row-level security. Versioned SQL migrations define schema, policies, indexes, triggers, and transactional functions.

### Authentication and Authorization

Authentication uses Supabase sessions. Application services resolve the current employee and role assignments; database RLS applies organization and record scope. Navigation visibility is a usability layer, not a security boundary. Sensitive operations and fields require explicit server-side checks.

## Module Boundaries

| Boundary | Responsibilities | Shared dependencies |
| --- | --- | --- |
| CRM / Sales / OMS | Customer context, quotation, opportunity, order and fulfilment | Customer, legal entity, product, inventory, finance |
| Procurement / WMS | Supplier, request, order, receipt and stock execution | Supplier, product, warehouse, approvals, finance |
| Finance | Open items, settlement, cash, vouchers, invoices and analysis | Sales and procurement source documents |
| HRM / OA | People, organization, lifecycle and collaboration workflows | Identity, roles, approvals, notifications, audit |
| BI / Search / AI | Read models, discovery and grounded assistance | Authorized data from all participating modules |

Modules communicate through shared identifiers, constrained database relationships, domain services, and transactional database functions. They do not use an asynchronous event bus in the current architecture.

## Major Data Flows

~~~mermaid
flowchart LR
  C[Customer] --> Q[Quotation]
  Q --> O[Sales order]
  O --> D[Fulfilment / delivery]
  D --> I[Inventory movement]
  D --> R[Receivable]
  R --> K[Cash allocation]

  PR[Purchase request] --> PO[Purchase order]
  PO --> GR[Goods receipt]
  GR --> I
  GR --> AP[Payable]
  AP --> K
~~~

### AI Retrieval Flow

An authenticated question is classified, searched across bounded authorized datasets, converted into compact context with source metadata, sent to the configured model, and recorded with usage and retrieval audit data. The model cannot write business data in the current version.

## APIs and Integrations

Internal interfaces consist of Server Actions, Route Handlers, and PostgreSQL functions. External integrations include managed authentication/database services, an AI model provider, enterprise identity, small-program authentication, and private file storage. Availability differs by environment; details are in [API](./engineering/API.md).

## Deployment Architecture

The application is built as a Node.js service behind a TLS reverse proxy. Secrets are injected at runtime, and database/storage services are independently managed. Releases should be immutable, health-checked, switchable, and reversible. No private hostnames, addresses, ports, or production paths are documented here.

## Planned Architecture

- Structured observability and service-level dashboards
- Formal read models or background jobs for expensive analytics
- Improved retrieval indexing and evidence evaluation
- A governed tool registry and planner for human-approved AI actions
- Integration adapters with explicit retry, idempotency, and failure queues

These are plans, not implemented production components.
