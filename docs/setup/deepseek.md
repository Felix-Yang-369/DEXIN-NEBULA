# 德小馨 DeepSeek 接入

德小馨 V0.1 通过 DeepSeek Chat Completions API 提供回答能力。所有请求只从
Next.js 服务端发出，API Key 不进入浏览器。

## 1. 创建 API Key

在 DeepSeek 开放平台创建独立的开发环境 API Key：

- API 文档：<https://api-docs.deepseek.com/guides/function_calling/>
- API 控制台：<https://platform.deepseek.com/api_keys>

开发、预览和生产环境应分别使用不同的 Key，并在平台设置用量预算和告警。

## 2. 本地配置

在 `.env.local` 中增加：

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

`DEEPSEEK_API_KEY` 只能保存在本地或部署平台的加密环境变量中，不得提交 Git，
不得使用 `NEXT_PUBLIC_` 前缀。

修改环境变量后需要重新启动开发服务。

## 3. Vercel 配置

在 Vercel 项目 `Settings → Environment Variables` 中添加相同的三个变量。
生产环境建议只启用 `Production`，预览环境使用单独的测试 Key。

## 4. 当前数据范围

V0.1 仅向 DeepSeek 发送与当前问题匹配且当前员工有权查看的：

- 已发布制度片段；
- 产品主档及当前岗位可见价格；
- 库存数量摘要。

不会发送客户、员工、财务、文件正文或其他员工的对话。模型只负责整理检索结果，
Supabase RLS 和服务端工具负责权限判断。

## 5. 验证

登录德馨星云并打开 `/ai`：

1. 页面显示“DeepSeek 服务已连接”；
2. 提问“请假申请需要经过哪些审批环节？”；
3. 回答下方出现制度来源；
4. 提问产品编号时显示当前账号有权查看的价格；
5. `ai_messages` 和 `ai_tool_calls` 产生当前员工自己的审计记录。

如果页面提示“等待配置 DeepSeek API”，检查变量是否生效并重启服务。
