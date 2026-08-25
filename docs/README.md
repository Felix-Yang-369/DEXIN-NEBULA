# DEXIN NEBULA Documentation

The English [README](../README.md) is the primary public entry; the synchronized Chinese version is [README.zh-CN.md](../README.zh-CN.md). Canonical documentation is organized by product, architecture, module, engineering, and public portfolio concerns.

## Canonical Documents

- [Project Overview](./PROJECT.md)
- [Product Requirements](./PRD.md)
- [Software Architecture](./ARCHITECTURE.md)
- [AI Architecture](./AI_ARCHITECTURE.md)
- [Milestone Roadmap](./ROADMAP.md)
- [Architecture Decisions](./DECISIONS.md)
- [Evaluation Framework](./EVALUATION.md)

## Modules

- Customer and revenue: [CRM](./modules/CRM.md), [Sales](./modules/SALES.md), [OMS](./modules/OMS.md)
- Supply chain: [Procurement](./modules/PROCUREMENT.md), [WMS](./modules/WMS.md)
- Enterprise operations: [Finance](./modules/FINANCE.md), [HRM](./modules/HRM.md), [OA](./modules/OA.md)
- Intelligence: [BI](./modules/BI.md)

All module documents use the same structure: purpose, users, entities, workflows, rules, permissions, dependencies, integrations, AI integration, limitations, and future work.

## Engineering

- [Development](./engineering/DEVELOPMENT.md)
- [Database](./engineering/DATABASE.md)
- [API](./engineering/API.md)
- [Security](./engineering/SECURITY.md)
- [Testing](./engineering/TESTING.md)
- [Deployment](./engineering/DEPLOYMENT.md)

## Public Portfolio

- [Case Study](./portfolio/CASE_STUDY.md)
- [Public Architecture](./portfolio/PUBLIC_ARCHITECTURE.md)
- [Demo Guide](./portfolio/DEMO_GUIDE.md)

These documents contain only sanitized information suitable for public presentation. Demonstrations must use synthetic data.

## Focused Specifications Retained

The refactor preserves useful detailed material rather than duplicating it in canonical documents:

- Product: [roles and permissions](./product/user-roles.md), [search](./product/search-system.md), [file center](./product/file-center-requirements.md), and [visual color system](./product/color-system.md)
- Process: [approvals, leave, and expense workflows](./processes/approval.md)
- Integrations: [Supabase](./integrations/supabase.md), [enterprise identity](./integrations/wecom.md), [AI provider](./integrations/deepseek.md), [small-program authentication](./integrations/miniprogram-auth.md), and [private file storage](./integrations/nas-webdav.md)
- Governance: [notifications and audit](./security/notifications-and-audit.md)

The former product overview, architecture, roadmap, development, testing, and deployment documents remain as legacy references temporarily. New changes should target the canonical files above; legacy duplicates can be removed after maintainers confirm that no internal workflow depends on their paths.

## Status Vocabulary

- **Implemented:** confirmed in source code, migrations, or reproducible tests.
- **In Progress:** a usable baseline exists, but validation or important capability remains incomplete.
- **Planned:** no complete current implementation is claimed.
- **TODO:** repository evidence or an owner decision is insufficient.

## Documentation Rules

- Do not include real business/personnel data, secrets, credentials, private infrastructure, or confidential financial information.
- Link to one authoritative definition instead of copying detailed rules.
- Update code, tests, module status, architecture, and release notes together when behavior changes.
- Keep public examples synthetic and label plans and unmeasured results explicitly.
