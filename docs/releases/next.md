# Deployed Scope Pending Business Acceptance

This page tracks capabilities already present in the deployed internal alpha but still requiring role-based business acceptance. It is not a public availability or quality guarantee.

## Included Capabilities

- Receipt/payment documents, print/export, state transitions, and reversal.
- Small-program login/session foundations and employee identity binding.
- Shared loading patterns and reorganized navigation.
- Controlled employee role assignment with confirmation, protection of critical roles, and audit.
- Private document storage through server-authorized access, with relational metadata and download audit.
- Database-filtered global search with broader permission-aware result types and identifier-first ranking.
- Consolidated authenticated application bootstrap data for identity, authorization, workspace preferences, and shell counters.
- Compact 232px/64px navigation with one-group accordion behavior and interaction-driven route prefetching.
- Lazy-loaded floating AI assistant with a transparent lightweight 3D avatar and a single-avatar resting state.
- Server-side customer pagination and bounded product, inventory, and finance initial queries.
- Targeted hot-path RLS policy consolidation and employee/customer-follow-up indexes.

## Engineering Validation

At the latest recorded release, lint, TypeScript, the workflow regression suite, and the production build passed. This evidence must be rerun for later code changes and does not replace business acceptance.

## Acceptance Pending

- Complete representative flows using standard employee, approver, finance, warehouse, and administrator roles.
- Confirm all required migrations in the intended non-production/production environments.
- Validate environment-dependent authentication callbacks without publishing their private configuration.
- Verify cash, approval, reversal, export, document, search, and permission isolation scenarios.
- Confirm backup, recovery ownership, and the last verified rollback release.
