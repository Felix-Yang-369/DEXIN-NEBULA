# Product Requirements Document

**Product:** DEXIN NEBULA

**Status:** In Progress
**Requirement states:** Implemented, In Progress, Planned

## Product Principle

Requirements use the chain **Problem → User → Scenario → Requirement → Success Metric**. A feature is not complete because a page exists; its data, permissions, state transitions, failure handling, auditability, and validation must work together.

## Functional Requirements

| Problem | User and scenario | Requirement | State | Success metric |
| --- | --- | --- | --- | --- |
| Customer context is scattered | Sales user prepares a quotation | Maintain customer, contact, legal-entity, follow-up, and quotation records with scoped access | Implemented | Authorized user completes the flow without duplicate master data |
| Order effects are disconnected | Sales and warehouse fulfil an order | Link order confirmation, fulfilment, delivery, inventory, and receivable effects | Implemented baseline | Valid order completes once; invalid stock or state is rejected |
| Purchasing lacks traceability | Requester, approver, buyer, and receiver collaborate | Link request, approval, purchase order, receipt, batch inventory, and payable | Implemented baseline | Each transition preserves actor, state, and financial/stock consistency |
| Finance records are hard to reconcile | Finance user reviews open items and cash | Support receivables, payables, settlement, cash documents, invoices, aging, and exports | Implemented baseline | Balances never become negative through invalid allocation; changes are traceable |
| Personnel workflows are fragmented | Employee, lead, and HR complete lifecycle work | Support employee records, organization, leave, attendance, lifecycle, performance, and approvals | Implemented baseline | Only assigned actors can perform valid transitions |
| Records are difficult to find | Any authorized employee searches | Provide global and module search with deterministic matching and scoped results | Implemented baseline | No unauthorized result is returned; relevant exact matches rank first |
| Enterprise questions need context | Authorized employee asks the AI assistant | Retrieve relevant permitted records and return a source-grounded, read-only answer | Implemented baseline | Answer cites available sources and declines unsupported claims |

Detailed rules are maintained in [module documentation](./modules/CRM.md) and focused legacy specifications linked from [the documentation index](./README.md).

## Non-Functional Requirements

### Permissions

- Authentication is required for protected business data.
- Authorization is enforced in server operations and PostgreSQL row-level policies, not only in navigation.
- Data scope must support self, department, assigned records, authorized functions, and organization-wide roles where explicitly granted.
- Sensitive fields and exports require additional permission checks.

### Reliability

- Multi-record stock and financial transitions must be transactional.
- Writes must validate current state and reject stale, duplicate, or unauthorized requests.
- External-service failure must not corrupt core business records.
- Critical changes must retain an audit trail and a recoverable deployment/database path.

### Performance Expectations

- Common authenticated pages and searches should remain interactive at the expected internal workload.
- List queries must be bounded and indexed on common filters and relationships.
- Slow operations must expose loading and failure states rather than appearing frozen.
- **TODO:** establish percentile latency targets after representative workload measurement.

### Data Requirements

- Shared organization, employee, customer, legal entity, product, supplier, and warehouse records are canonical master data.
- Monetary values use fixed-precision database types; timestamps and status values use explicit semantics.
- No dashboard or AI result may invent operational data when a source is missing.
- Real data must not be committed to source control or public demonstration assets.

### AI Requirements

- AI retrieval inherits the authenticated user's database permissions.
- The model receives only relevant, bounded context and must distinguish metadata from document content.
- Answers cite sources and acknowledge insufficient evidence.
- Conversation, retrieval, latency, and model usage are recorded without exposing secrets.
- Current AI is read-only. Any future write tool must require explicit confirmation, server re-authorization, idempotency, and audit.

## Explicitly Out of Scope

- Unauthenticated access to operational data
- Full general ledger, tax filing, payroll, or statutory reporting
- Autonomous approval, payment, deletion, or record mutation
- Guaranteed mobile parity for every high-density administrative screen
- Public claims based on unmeasured performance or AI quality

## Release Acceptance

A release requires relevant automated checks, role-based workflow acceptance, migration and rollback review, loading/empty/error/forbidden states, privacy review for exposed material, and updated status documentation. See [Testing](./engineering/TESTING.md).
