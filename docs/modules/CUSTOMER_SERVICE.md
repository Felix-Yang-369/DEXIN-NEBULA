# 客服中心

## Purpose

客服中心集中承载德馨旗下网站的公开 AI 接待、采购留资和人工客服工作台。首个工作空间为德馨淼盛官网，公开助手名称为“德小馨”。

## Architecture

- 官网只保留轻量启动器，通过受限 iframe 加载德馨星云的公开客服页面。
- 访客会话使用服务端签名的不透明令牌；令牌按工作空间、来源网站、访客和会话绑定，并只保存哈希。
- 所有公开写入都经过 `/api/customer-service/public/*` Route Handler。浏览器不持有 Supabase 管理密钥，也不能直接访问客服表。
- AI 只检索 `published` 状态的公开客服知识。内部 AI 的客户、库存、财务、员工和审批检索不会进入公开客服上下文。
- 人工消息通过可重连的 SSE 流传回官网；消息先持久化，再推送，断线后按序号补发。

## Workflows

1. 官网建立访客和会话，恢复有效历史或签发新令牌。
2. AI 回答公开问题；涉及实时库存、最终价格、账期、合同和交期承诺时转人工。
3. 转人工向具备接待权限的员工发送站内通知，并在企业微信已配置时发送应用消息。
4. 第一位回复者在数据库事务中自动认领会话；其他人需要等待转交或释放。
5. 客户留资先进入客服线索池。客服可记录跟进，确认后通过幂等 RPC 去重并转为 CRM 客户。

## Permissions

- `customer_service.dashboard.view`
- `customer_service.conversation.view/reply/transfer`
- `customer_service.lead.view/manage/convert`
- `customer_service.knowledge.view/publish`
- `customer_service.settings.manage`
- `customer_service.export.run`

迁移为每个组织创建可编辑的“客服坐席”和“客服主管”角色，并为管理员、董事长赋予全部客服权限。页面可见性不是授权边界；数据库函数和 RLS 才是最终控制。

## Retention and Operations

- 会话、未转换线索和访客标识保留 365 天，之后由数据库定时任务匿名化。
- 已转换 CRM 客户不由客服匿名化任务处理。
- 生产环境必须配置 `CUSTOMER_SERVICE_TOKEN_SECRET`、Supabase 服务端密钥以及可选的 DeepSeek、企业微信参数。
- 反向代理必须关闭客服流式接口缓冲，并为 SSE 保持合理的读取超时。
- 反向代理不得为客服嵌入路由追加 `X-Frame-Options: DENY/SAMEORIGIN`，并应保留应用返回的 `frame-ancestors` 白名单。
- 正式执行迁移和部署前必须完成数据库备份、开发环境 RLS 验证及双人接待竞争测试。
