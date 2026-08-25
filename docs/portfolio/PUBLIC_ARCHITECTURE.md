# Public Architecture

This view is safe for portfolios, interviews, technical demonstrations, and academic applications. It omits private infrastructure, production identifiers, credentials, confidential rules, and real data.

~~~mermaid
flowchart TB
  subgraph Experience
    UI[Next.js / React application]
    SEARCH[Global search]
    AI[AI assistant]
  end

  subgraph Application
    BFF[Server Actions and Route Handlers]
    DOMAIN[Domain services and workflow rules]
    AUTHZ[Authentication and authorization]
  end

  subgraph Data
    PG[(PostgreSQL)]
    RLS[Row-level security]
    FILES[Private file storage]
  end

  subgraph Enterprise Modules
    CRM[CRM / Sales / OMS]
    SCM[Procurement / WMS]
    OPS[Finance / HRM / OA / BI]
  end

  subgraph AI Layer
    ROUTER[Intent router]
    RETRIEVAL[Authorized retrieval]
    MODEL[Language model]
    AUDIT[Usage and evidence audit]
  end

  UI --> BFF --> DOMAIN
  DOMAIN --> AUTHZ --> RLS --> PG
  DOMAIN --> FILES
  DOMAIN --> CRM & SCM & OPS
  AI --> ROUTER --> RETRIEVAL --> RLS
  RETRIEVAL --> MODEL --> AI
  MODEL --> AUDIT
  SEARCH --> RLS
~~~

## Architectural Characteristics

- **Modular monolith:** one deployable application with explicit domain-oriented feature code.
- **Layered authorization:** authenticated server operations plus database row-level policies.
- **Transactional workflows:** critical cross-table inventory, finance, and approval effects are atomic.
- **Shared platform services:** identity, roles, notification, audit, documents, search, and AI serve multiple modules.
- **Read-only grounded AI:** authorized retrieval and citations precede any future agentic capability.
- **Reproducible evolution:** schema, functions, policies, and indexes are versioned as SQL migrations.

## Current Versus Planned

Implemented architecture includes the web application, server operations, PostgreSQL/RLS, core enterprise modules, private file proxying, global search, and read-only retrieval-augmented AI.

Planned research includes stronger observability, semantic retrieval, governed tool schemas, human-approved plans, background processing where justified, and reusable analytical read models. No planned component is represented as production-ready.
