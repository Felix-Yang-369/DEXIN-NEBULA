# 德馨星云 DEXIN NEBULA

> 德馨淼盛企业数字化运营平台  
> Enterprise Digital Operating Platform

德馨星云用于连接组织协同、客户经营、销售订单、产品、供应链、仓储、财务、经营分析与德小馨 AI。项目当前首先服务德馨淼盛内部，不是对外开放注册的 SaaS，也不以替代金蝶全部会计能力为当前目标。

## 当前状态

更新时间：2026-08-14

| 项目 | 当前结论 |
| --- | --- |
| 当前版本 | `V0.9-alpha` |
| 当前阶段 | 2026-08-14 新版已部署到阿里云，等待业务验收 |
| 工程规模 | 多模块 Next.js 应用、业务服务层和 PostgreSQL 迁移体系 |
| 运行模式 | Next.js App Router + Supabase + PostgreSQL RLS |
| 使用对象 | 内部员工、负责人、人事、财务、董事长和管理员 |
| 数据原则 | 真实数据优先；无来源指标显示空状态，不伪造经营趋势 |
| 正式域名 | 系统 `app.nebula.dexinmiaosheng.cn`；介绍站 `nebula.dexinmiaosheng.cn` |
| 本地验证 | ESLint、TypeScript、77 项自动化测试和生产构建已通过 |
| 云端部署 | 阿里云 ECS 生产环境正常，正式入口为 `app.nebula.dexinmiaosheng.cn` |

## 当前产品架构

```text
德馨星云 DEXIN NEBULA
├── 经营总览 OVERVIEW
│   ├── 驾驶舱 DASHBOARD
│   ├── 数据分析 BI
│   ├── 智能助手 AI ASSISTANT
├── 业务管理 BUSINESS
│   ├── 客户管理 CRM
│   ├── 销售管理
│   ├── 订单管理
│   ├── 供应链管理（SRM / 采购 / WMS）
│   └── 产品管理 PIM
├── 运营管理 OPERATION
│   ├── 新媒体管理
│   ├── 人力资源 HRM
│   └── 文件中心
├── 财务管理 FINANCE
│   ├── 应收应付
│   ├── 银行流水与核销
│   ├── 发票与凭证
│   └── 财务报表与利润分析
└── 协同办公 OA
    ├── 审批、公告、周报与通知
    └── 系统管理 IAM
```

## 模块进度

| 模块 | 状态 | 当前能力 | 主要未完成项 |
| --- | --- | --- | --- |
| 登录与账号 | 可用 | Supabase 登录、会话、停用拦截、个人资料、头像 | 企业微信扫码需正式 HTTPS 回调域验收 |
| 驾驶舱 | 可用 | 权限内 KPI、审批待办、库存风险、业务结构、快捷入口 | 销售趋势依赖正式订单持续积累 |
| CRM | 可用 | 客户分级、Logo、联系人、跟进、负责人、多法律实体、审计 | 批量导入、重复客户治理和客户合并 |
| 报价 | 可用 | 客户与产品联动、授权价格、快照、状态历史、打印 | 正式 PDF 模板与电子签章 |
| 销售与订单 V0.8 | 首版可用 | 机会、订单、商品明细、交易实体、确认、取消、履约 | 退货、复杂订单变更、实际毛利结转 |
| SRM | 可用 | 供应商、联系人、资质、结算信息、到期提醒、审计 | 供应商绩效与准入审批 |
| 采购 V0.9 | 首版可用 | 采购申请、审批、订单、确认、到货入库、采购应付 | 退货、采购变更、异常到货深化 |
| WMS | 首版可用 | 库存、批次效期、出入库、调拨、盘点、配送、Excel 导出 | 扫码、第三方仓接口、正式盘点编排 |
| 财务 FMS | 首版可用 | 应收应付、类 Excel 编辑、账龄、对账单、流水核销、凭证、发票 | 银行自动对账、总账、税务与金蝶集成 |
| 产品 PIM | 可用 | 产品主档、图片、四类价格、质量检查、库存关联、Excel 导出 | 产品版本、组合 BOM、批量更新工作流 |
| HRM | 首版可用 | 组织、员工、合同、假期、考勤、入离职、职级岗位、绩效 | 完整薪资、招聘、培训 |
| OA | 可用 | 审批、请假、报销、用印、公告、消息、周报、制度、文件 | 外出、加班、固定资产等模板深化 |
| BI | 首版可用 | 客户结构、应收账龄、库存风险、组织人数、订单状态、覆盖度 | 收入成本毛利趋势需持续积累数据 |
| 德小馨 AI | V0.2 | DeepSeek 对话、权限内检索、来源引用、对话与用量审计 | 附件正文检索、受控写操作、评测和成本治理 |
| 运营管理 | 规划入口 | 新媒体、企业宣传、企业活动页面和能力定义 | 数据模型、权限、流程、统计和外部接口 |
| 系统管理 | 可用 | 角色权限、组织账号、日志、系统入口 | 权限配置体验与流程设计器深化 |

## 关键业务闭环

### 销售闭环 V0.8

```text
客户与法律实体 → 销售机会 → 报价 → 销售订单
→ 仓库履约与配送 → 销售应收 → 银行收款与核销
```

- 销售订单确认前必须绑定客户法律实体。
- 履约校验可用库存，并在事务中生成出库、配送和应收。
- “预计毛利”只对授权角色显示，不能替代正式会计利润。

### 采购与财务闭环 V0.9

```text
采购申请 → 负责人审批 → 采购订单 → 到货入库与批次
→ 采购应付 → 银行付款 → 核销、凭证和审计
```

- 应付金额按实际到货形成，不在采购订单创建时提前确认。
- 银行流水支持分次核销，核销同步更新余额、收支和凭证。
- 关键跨表写入通过 PostgreSQL 事务函数执行。

## 权限与安全

- Supabase Auth、服务端权限和 PostgreSQL Row Level Security 同时生效。
- 普通员工、负责人、人事、财务、董事长和管理员拥有不同页面、操作和数据范围。
- 文件中心正文存入公司 NAS，Supabase 保存文件元数据并通过 RLS 控制访问；其他图片仍使用受控 Supabase Storage。
- 身份证、银行卡、工资、合同、客户价格和供应商结算信息按敏感数据处理。
- 写操作、审批、导出、权限变化和关键财务动作记录审计日志。
- `.env.local`、服务端密钥和真实测试密码不得提交到 Git。

## 技术栈

| 层级 | 当前实际技术 |
| --- | --- |
| Web | Next.js 16 App Router、React 19、TypeScript |
| UI | Tailwind CSS 4、shadcn/ui、Base UI、Lucide、Recharts |
| 数据 | Supabase、PostgreSQL、Supabase JS/SSR |
| 数据库变更 | `supabase/migrations/*.sql` |
| 校验 | Zod + 服务端业务校验 |
| 文件 | 绿联 NAS WebDAV（文件中心正文）+ Supabase（元数据、权限与其他图片） |
| AI | DeepSeek API 服务端调用 |
| Excel | ExcelJS |
| 部署 | 阿里云 ECS + PM2 + Nginx；Vercel 保留历史部署 |
| 包管理 | npm + `package-lock.json` |

当前没有使用 Prisma、React Hook Form、Vitest 或 Playwright，不要为了匹配旧规划而无目的引入。

## 主要路由

| 领域 | 路由 |
| --- | --- |
| 登录、账号 | `/login`、`/account` |
| 驾驶舱 | `/dashboard` |
| 客户、报价、销售 | `/customers`、`/quotes`、`/sales` |
| 供应商、采购 | `/suppliers`、`/purchasing` |
| 仓储 | `/inventory`、`/inventory/operations` |
| 产品 | `/products` |
| 财务 | `/finance` 及其应收、应付、核销、发票子路由 |
| HRM | `/hr`、`/organization`、`/employees` 及 HR 子路由 |
| OA | `/oa`、`/approvals`、`/announcements`、`/notifications`、`/reports/weekly`、`/knowledge`、`/documents` |
| BI 与 AI | `/bi`、`/ai` |
| 运营管理 | `/operations/media`、`/operations/publicity`、`/operations/events` |
| 系统 | `/system`、`/roles`、`/audit` |

## 本地运行

环境要求：Node.js 20.9 以上，推荐与服务器一致的 Node.js 22。

```bash
npm ci
# 仅全新克隆且本地尚无环境文件时执行
test -f .env.local || cp .env.example .env.local
npm run dev
```

```bash
npm run check          # ESLint + TypeScript
npm run test:workflow  # 业务流程、权限与登录安全测试
npm run build          # 生产构建
npm run start          # 启动生产服务
```

环境变量键名以 [.env.example](./.env.example) 为准。主要包括 Supabase、企业微信、DeepSeek、`NEXT_PUBLIC_APP_URL` 和数据库连接变量。

## 项目文档

统一入口见 [文档中心](./docs/README.md)，其中包括：

- 产品需求、路线图、角色权限和品牌规范
- 业务流程、开发规范与测试标准
- Supabase、企业微信、DeepSeek 和小程序接入
- 部署、域名、回滚和正式版本记录

数据库迁移位于 [`supabase/migrations`](./supabase/migrations)。已经执行的迁移不得修改，修复必须新增迁移。

## 部署状态

当前正式业务系统托管在阿里云 ECS：

- `https://app.nebula.dexinmiaosheng.cn`：德馨星云业务系统、登录、Supabase 邮件回调和企业微信登录回调。
- `https://nebula.dexinmiaosheng.cn`：德馨星云对外介绍站，只通过明确按钮进入业务系统。

当前生产版本和部署验证见 [2026-08-14 阿里云发布记录](./docs/releases/2026-08-14-aliyun.md)。上一版见 [2026-08-12 发布记录](./docs/releases/2026-08-12-production.md)，部署与回滚约定见 [部署与回滚规范](./docs/operations/deployment.md)。

本次已发布内容见 [下一版本记录](./docs/releases/next.md)，完成业务验收后再归档为正式版本范围。

## 下一阶段优先级

详细优先级与上线门槛见 [版本路线图](./docs/product/roadmap.md)。README 不重复保存容易过期的计划清单。

## 上线边界

- 核心角色权限验收通过。
- 数据库备份与恢复演练完成。
- Vercel 部署和回滚流程可重复执行；历史阿里云环境有独立维护说明。
- 敏感文件与财务数据访问验证通过。
- 手机和电脑完成核心流程验收。
- 域名备案、HTTPS 和企业微信回调完成后，再开放正式域名。

## 协作规范

开发和 AI Agent 必须先阅读 [AGENTS.md](./AGENTS.md)。README 只记录当前事实、稳定结构和运行方式；详细设计放入 [文档中心](./docs/README.md)，每次正式上线记录到 `docs/releases/`。

## 版权

本项目为德馨淼盛内部系统。代码、数据、文档和品牌素材均属于公司内部资产；未经授权不得公开真实员工、客户、供应商、价格、库存或财务数据。
