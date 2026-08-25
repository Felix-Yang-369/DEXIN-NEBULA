# Evaluation Framework

This document defines how DEXIN NEBULA should be evaluated objectively. It does not invent results. Unless a result is linked to a reproducible run, its status is **Pending**.

## Evaluation Principles

- Use synthetic or explicitly approved test data.
- Separate software correctness, operational performance, AI quality, and business outcome.
- Report dataset, role, environment class, timestamp, sample size, and measurement method.
- Include failure cases and confidence intervals where sample size permits.
- Never publish confidential records, prompts containing private data, or infrastructure identifiers.

## Software Metrics

| Metric | Method | Initial target | Current result |
| --- | --- | --- | --- |
| Workflow completion | Run canonical sales, procurement, approval, and finance scenarios | 100% of release-blocking scenarios | Pending formal baseline |
| Authorization correctness | Role-by-action/row/field matrix with negative tests | No unauthorized success or disclosure | Pending formal baseline |
| Transaction consistency | Inject invalid state, duplicate, and partial-failure cases | No partial stock/finance effects | Pending formal baseline |
| Error rate | Structured application logs by request/workflow | TODO after traffic baseline | Pending |
| Response latency | p50/p95 for representative pages, search, and mutations | TODO after workload definition | Pending |
| Automated regression | Lint, type check, workflow tests, production build | All release-required checks pass | Run-specific; see release evidence |
| Recovery | Timed deployment and database recovery exercise | TODO with operator owner | Pending |

## AI Metrics

| Metric | Definition | Evaluation method | Current result |
| --- | --- | --- | --- |
| Task success | Answer satisfies a labelled enterprise question | Human rubric, blinded where practical | Pending |
| Routing accuracy | Selected domains match labelled intent | Classification test set | Pending |
| Retrieval quality | Relevant authorized evidence appears in top results | Precision@k, Recall@k, MRR | Pending |
| Source correctness | Citation supports the associated claim | Claim-source annotation | Pending |
| Hallucination rate | Unsupported material claims per answer | Evidence-based review | Pending |
| Refusal correctness | Declines missing or unauthorized evidence | Positive/negative adversarial set | Pending |
| Multi-step completion | Completes governed plan correctly | Planned-agent sandbox only | Not applicable to current read-only AI |
| Latency | End-to-end and retrieval/model breakdown | p50/p95 over fixed prompts | Pending |
| Inference usage | Input/output tokens per successful task | Usage logs + task labels | Pending |

## Benchmark Design

Create a versioned synthetic benchmark with questions across CRM, orders, inventory, finance, HR, OA, search, and documents. Each case should define user role, permitted rows/fields, expected intent, relevant source IDs, acceptable answer facts, required caveats, and prohibited disclosures.

The suite should contain:

- Exact-code and fuzzy-name retrieval
- Ambiguous cross-module queries
- Empty-data and stale-data cases
- Unauthorized and sensitive-field probes
- Prompt injection inside retrieved content
- Conflicting sources and time-bound questions
- Model outage, timeout, and malformed response cases

## Release Gates

1. All affected workflow and authorization cases pass.
2. No critical privacy or transaction-consistency failure remains open.
3. AI changes meet approved groundedness and refusal thresholds on the fixed benchmark.
4. Latency and inference usage regressions are explained and accepted.
5. Evaluation artifacts contain no real business data.

## Reporting Template

For each evaluation run record: commit/build identifier, benchmark version, environment class, configuration version, sample count, metric results, failed case IDs, reviewer, and known limitations. **TODO:** assign metric owners and approve numerical release thresholds.
