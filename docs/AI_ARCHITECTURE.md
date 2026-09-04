# AI Architecture

**Current status:** read-only retrieval-augmented assistant implemented; agentic execution planned.

## Design Goal

AI is treated as a governed system layer over enterprise capabilities. Its value comes from permission-aware evidence and reliable task boundaries, not from presenting a general chatbot inside the application.

~~~mermaid
flowchart TD
  U[User] --> A[AI assistant]
  A --> R[Intent classification and routing]
  R --> P[Bounded retrieval plan]
  P --> T[Read-only tool layer]
  T --> CRM[CRM]
  T --> OMS[Orders]
  T --> WMS[Inventory]
  T --> FIN[Finance]
  T --> SRCH[Search]
  T --> DOC[Knowledge and document metadata]
  CRM & OMS & WMS & FIN & SRCH & DOC --> E[Authorized enterprise context]
  E --> M[Model]
  M --> C[Cited answer]
~~~

## Current Layers

### Model Layer — Implemented

A server-side chat endpoint calls a configured language-model service with a constrained system instruction, recent conversation context, and retrieved enterprise evidence. Model name, token usage, and latency are recorded. Credentials remain server-only.

### Intent and Routing — Implemented Baseline

Deterministic query classification identifies likely domains such as knowledge, product, inventory, customer, supplier, employee, announcement, document, approval, quotation, and finance. Explicit intent runs only the relevant domain queries; broad questions retain cross-domain fallback. Each query is constrained by a sanitized business-object term and an 80-row maximum candidate set before deterministic ranking. This is not a learned semantic router.

### Planning — Limited

The current “plan” is a bounded set of parallel read queries chosen by intent. There is no general multi-step planner, plan revision, or autonomous goal loop.

### Tool Layer — Implemented Read-Only Retrieval

Retrieval queries enterprise tables through the authenticated Supabase client. PostgreSQL RLS limits visible rows. Results are ranked, compacted, capped, and labelled as sources. No tool can create, approve, pay, delete, or edit a record.

### RAG — Implemented Baseline

Retrieval currently uses normalized terms, intent-specific candidate sets, database filters, and deterministic relevance scoring. It covers structured records, published knowledge, and document metadata. It does not claim to read attachment bodies unless the retrieved source contains that text.

### Memory — Implemented Short-Term Conversation History

Conversations and messages are persisted per authorized employee, with a bounded recent window supplied to the model. There is no profile memory, cross-user memory, vector memory, or autonomous memory consolidation.

### Enterprise Data Access and Permissions

AI uses the same authenticated database context as the user. RLS remains the primary row boundary; server logic additionally limits fields, record counts, and intent. Prompt instructions cannot grant access. The system should decline when evidence is missing.

### Human-in-the-Loop Controls

Current AI is read-only, which is the strongest present control. For any future mutation tool, the minimum design is: preview → explicit user confirmation → server re-authorization → state/version validation → idempotent transaction → audit → result confirmation.

### Observability — Implemented Baseline

Conversation records, messages, retrieval/tool-call audit entries, model identifier, token counts, and request duration are stored. A complete operational dashboard, quality traces, prompt versioning, and privacy retention policy remain planned.

### Failure Handling — Implemented Baseline

The endpoint validates input, limits request frequency, times out upstream calls, maps unavailable/configuration/upstream errors to safe messages, rejects inaccessible conversations, and declines unsupported answers through the system instruction. Core modules remain usable when AI is unavailable.

## Evaluation

The repository contains workflow tests but not a complete AI benchmark. Evaluation should measure retrieval recall/precision, source correctness, groundedness, refusal correctness, tool-selection accuracy, latency, task completion, and inference usage. See [Evaluation Framework](./EVALUATION.md).

## Planned Agent Architecture

~~~text
Request → policy gate → router → explicit plan → governed tool registry
        → confirmation for effects → transactional execution → audit → response
~~~

Planned work includes structured tool schemas, risk classification, plan inspection, read/write separation, approval checkpoints, replayable traces, and adversarial evaluation. These capabilities must not be described as implemented until code, tests, and operational acceptance exist.
# 内部业务工具 API V1

德小馨的对话检索之外，系统提供仅限已登录员工调用的内部 Tool API：`POST /api/ai/tools`。首批工具为应收汇总、库存可用量和销售订单链路，均为只读查询。接口使用当前 Supabase 会话、数据库 RLS 与既有受控 RPC，不接受模型或浏览器提供的身份、SQL、任意表名或写入指令。

工具名称必须来自服务端白名单，输入使用 Zod 校验，结果被限制在业务所需字段与数量范围内。工具执行日志仅记录工具名、员工标识和耗时，不记录查询文本、业务正文或凭据。后续“创建草稿”类工具必须复用现有事务函数，显示执行计划并要求人工确认；提交、审批、过账和付款不属于 Agent 可执行范围。

当前已提供两类零副作用草稿计划：销售订单草稿计划与会计凭证草稿计划。它们仅验证字段、计算总额或借贷平衡，并返回人工确认入口；尚不创建订单、凭证或任何数据库记录。
