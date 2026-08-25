# Public Demo Guide

## Goal

Demonstrate connected enterprise workflows, permission boundaries, search, and grounded AI without exposing real people, customers, suppliers, prices, files, credentials, or infrastructure.

## Safe Demo Environment

- Use a separate non-production project and synthetic seed data.
- Use fictional organizations, people, counterparties, products, addresses, and amounts.
- Use dedicated demo accounts for each role; store passwords outside the repository and recording.
- Disable or replace production callbacks, messaging, storage, and external side effects.
- Review browser history, downloads, logs, screenshots, and AI prompts before sharing.

## Suggested Story

1. **Role boundary:** sign in as a standard sales user and show that finance/administration scope is not available.
2. **Customer to quotation:** open a fictional customer, contact/follow-up history, and an authorized quotation.
3. **Order to cash:** show a prepared order progressing to fulfilment, inventory movement, receivable, and synthetic cash allocation.
4. **Procure to pay:** show an approved purchase request, order, receipt, batch inventory, payable, and synthetic settlement.
5. **Collaboration:** submit a synthetic leave or expense request, then switch to the assigned approver and complete a valid transition.
6. **Search:** search an exact synthetic code and a fuzzy name; demonstrate grouped results and permission scope.
7. **AI:** ask a question answerable from the synthetic records; verify citations and then ask an unsupported/unauthorized question to demonstrate refusal.
8. **Audit:** show the minimum necessary event history without sensitive free text.

## Reset and Repeatability

Prepare a documented seed version and a non-destructive reset process. Each demo scenario should have known starting states, expected transitions, and cleanup. Do not reset a shared or production database.

## Recording Checklist

- No real names, domains, notifications, browser bookmarks, environment files, account emails, or storage paths are visible.
- No console/network view exposes authorization headers or private endpoints.
- Amounts and identifiers are labelled synthetic.
- Screenshots do not reveal data outside the intended role.
- AI answers cite only the demo dataset.
- The narration distinguishes Implemented, In Progress, and Planned capabilities.

## Demo Limitations to State

DEXIN NEBULA is an internal alpha, not a public SaaS offering. Current AI is read-only. Full statutory accounting, complex returns, autonomous actions, and formal benchmark results are not claimed. Performance observed in a demo is not a production service-level guarantee.

## TODO Before Publishing Media

Create a fully synthetic seed package, obtain a privacy/security review, record stable benchmark results, and approve project attribution/licensing language.
