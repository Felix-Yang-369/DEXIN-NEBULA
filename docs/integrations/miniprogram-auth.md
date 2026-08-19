# 微信小程序认证接入

更新时间：2026-08-12

德馨淼盛微信小程序与德馨星云共用同一套 Supabase / PostgreSQL 主数据，但小程序不直接连接数据库。微信登录凭证由 Next.js 服务端换取 OpenID，再签发可撤销的小程序专用会话。

## 已实现范围

```text
POST /api/miniprogram/auth/wechat-login
GET  /api/miniprogram/auth/session
POST /api/miniprogram/auth/logout
```

- 登录使用微信 `jscode2session`，AppSecret 不下发到客户端。
- 身份使用 `app_id + open_id` 唯一识别，可保存 UnionID。
- 员工身份通过 `miniprogram_identities.employee_id` 绑定现有 `employees`。
- 员工状态及角色在服务端实时读取，不信任客户端传入角色。
- 会话令牌仅在创建时返回明文，数据库只保存 SHA-256 哈希。
- 会话默认有效 12 小时，可主动退出或在服务端撤销。
- 身份和会话表启用 RLS，`anon` 与 `authenticated` 无表权限，仅服务端 `service_role` 可访问。

## 环境配置

在部署环境配置以下变量，不要提交真实值：

```bash
WECHAT_MINIPROGRAM_APP_ID=
WECHAT_MINIPROGRAM_APP_SECRET=
WECHAT_MINIPROGRAM_SESSION_TTL_HOURS=12
```

同时需要已有的 Supabase 服务端变量。`WECHAT_MINIPROGRAM_APP_SECRET` 与 Supabase service role key 只能存在于服务端环境。

## 数据库迁移

本次新增迁移：

```text
supabase/migrations/20260812074336_miniprogram_auth_sessions.sql
```

当前迁移尚未执行到远程 Supabase。执行前必须确认目标项目、数据库备份和回滚路径，并先审查迁移内容。不要修改已经在目标环境执行过的迁移文件，后续修复应创建新迁移。

迁移建立：

- `miniprogram_identities`：微信身份、状态及可选员工绑定。
- `miniprogram_sessions`：令牌哈希、有效期、最后访问和撤销时间。

## 员工绑定

新微信身份默认是 `customer`。员工绑定必须由可信的管理流程完成，不能接受小程序提交 `employeeId` 或角色。首轮内测可由管理员核对员工本人后，在受控后台或数据库操作中将身份的 `employee_id` 绑定到有效员工。

绑定后，下一次登录或调用会话接口会读取最新员工状态：

- 无员工绑定：`customer`
- 有有效员工绑定：`employee`
- 员工包含 `admin` 角色：`admin`
- 身份被阻止或员工停用：拒绝访问

正式上线前应补充带审计记录的员工绑定/解绑管理界面，并明确身份核验流程。

## 联调步骤

1. 在微信公众平台取得小程序 AppID 与 AppSecret。
2. 在测试部署环境配置上述环境变量。
3. 审查并执行数据库迁移。
4. 将 Next.js API 部署到 HTTPS 域名。
5. 在微信公众平台把 API 域名配置为 request 合法域名。
6. 在小程序 `miniprogram/config/env.ts` 填写测试 API 地址，将 `apiMode` 从 `mock` 改为 `remote`。
7. 先验证客户登录，再完成一个测试员工的可信绑定并验证员工入口。
8. 验证停用身份、停用员工、过期令牌和退出登录。

## 上线前待办

- 在网关或服务端增加登录接口限流，并监控异常失败率。
- 增加会话清理任务，定期清除过期及长期撤销记录。
- 建立员工绑定、解绑和停用的审计流程。
- 完成真实微信开发者工具及 iOS / Android 真机测试。
- 确认生产域名、HTTPS、隐私指引和微信平台服务器域名配置。

在这些项目完成前，客户端应继续默认使用 `mock` 模式，不应把认证首版视为已具备生产开放条件。
