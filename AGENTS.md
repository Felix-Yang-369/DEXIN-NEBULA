<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 德馨星云项目规则

开始任何开发任务前，先阅读 [README.md](./README.md)，确认当前产品状态、运行方式和已知边界。

再根据任务阅读对应专题文档：

- [架构与产品边界](./docs/development/architecture.md)
- [开发与安全规范](./docs/development/coding-standards.md)
- [测试与完成标准](./docs/development/testing.md)
- [部署与回滚规范](./docs/operations/deployment.md)

## 必须遵守

- 使用 npm 和 `package-lock.json`，不要混用 pnpm 或 yarn。
- 开始前检查现有修改；用户文件和未提交改动不得覆盖。
- 不提交 `.env.local`、密钥、真实业务数据、`node_modules` 或 `.next*` 缓存。
- 数据库结构变化必须新增迁移，不修改已经执行的迁移。
- 权限必须在服务端和数据库层落实，隐藏前端按钮不能代替权限控制。
- 涉及身份、权限、金额、库存、员工隐私或生产数据时，先确认风险和回滚方式。
- 未经用户明确授权，不推送代码、不部署、不执行生产数据修改。
- 功能或运行方式发生变化时，同步更新 README 或对应 `docs/` 文档。

## 基本验证

按改动风险运行：

```bash
npm run check
npm run test:workflow
npm run build
```

如果某项无法通过或无法执行，交付时必须说明原因和影响范围。
