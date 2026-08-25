# Supabase 开发环境接入

## 1. 目标

本指南用于把德馨星云从本机演示模式切换到真实账号和数据库模式。首批接入范围包括：

- 邮箱密码登录和 Cookie 会话
- 组织、部门、员工和直属负责人关系
- 普通员工、部门负责人、人事、财务、管理员和董事长角色
- 请假申请、审批待办和审批历史
- PostgreSQL Row Level Security

开发、测试和生产必须使用不同的 Supabase 项目，不得把真实员工隐私复制到本地演示环境。

## 2. 创建项目

1. 在 Supabase 创建一个仅用于开发的项目。
2. 在项目的 Connect 页面取得 Project URL 和 Publishable key。
3. 复制 `.env.example` 为 `.env.local`。
4. 填入：

```env
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
```

当前用户登录和业务操作不需要 `SUPABASE_SERVICE_ROLE_KEY`。除非以后开发受控的后台账号创建服务，否则保持为空。服务角色密钥不得出现在浏览器代码、截图或 Git 中。

## 3. 执行数据库迁移

当前迁移：

```text
supabase/migrations/202607280001_auth_organization_approvals.sql
supabase/migrations/202607280002_employee_administration.sql
supabase/migrations/202607280003_finance_management.sql
supabase/migrations/202607280004_inventory_management.sql
supabase/migrations/202607280005_customer_management.sql
supabase/migrations/202607280006_roster_ready_employee_profiles.sql
supabase/migrations/202607280007_private_employee_avatars.sql
supabase/migrations/202607280008_product_information_management.sql
supabase/migrations/202607280009_generic_approvals_expenses.sql
supabase/migrations/202607290010_notifications_audit.sql
supabase/migrations/202607290011_knowledge_center.sql
supabase/migrations/202607290012_weekly_reports.sql
supabase/migrations/202607290013_announcements.sql
supabase/migrations/202607290014_warehouse_batches_imports.sql
supabase/migrations/202607290015_inventory_export_audit.sql
```

必须按文件名顺序执行。可使用 Supabase CLI 执行迁移，也可以在全新的开发项目中通过 SQL Editor 执行。执行后应确认：

- 组织、审批、员工、财务、仓储、客户、产品、通知和审计相关业务表已经创建
- 所有业务表已启用 Row Level Security
- `submit_leave_request` 和 `process_leave_request` 函数存在
- `manage_employee_profile`、`set_employee_roles` 和 `link_employee_auth_user` 函数存在
- `update_product_master`、产品分级价格策略和 `product-images` 私有存储桶存在
- `submit_expense_claim`、`process_approval_request` 和通知已读函数存在
- `anon` 角色不能读取业务表

不要在已经承载数据的项目中重复执行首版迁移。后续结构变化应增加新的迁移文件。

## 4. 初始化组织和角色

参考：

```text
supabase/seed.example.sql
```

该脚本建立示例组织、首批部门和基础角色。示例脚本不包含真实员工姓名、邮箱或 Auth UUID。

## 5. 创建首批员工账号

建议先创建四个独立测试账号：

1. 普通员工
2. 直属负责人
3. 董事长
4. 行政人事

先由人事或管理员在 `/employees` 创建员工档案并设置直属负责人。需要登录的员工，再由管理员在 Supabase Authentication 中创建用户，并在员工管理页面输入 Auth User UUID 完成绑定。系统会校验 Auth 邮箱与员工档案邮箱一致。

员工档案必须同时设置：

- `organization_id`
- `department_id`
- `employee_no`
- `name`
- `email`
- `status = 'active'`
- 普通员工的 `manager_id`

管理员可在员工管理页面分配角色。董事长需要 `chairman`，行政人事需要 `hr`，负责人建议同时拥有 `department_lead`；每位员工至少保留 `employee`。

每个组织当前应至少有一个在职董事长角色和一个在职人事角色，否则超过一天的请假或人事备案无法生成下一审批节点。

## 6. 安全边界

### 登录与账号状态

- Proxy 只验证经过签名校验的登录身份，并负责刷新会话 Cookie。
- 登录后还会读取员工档案；未绑定或 `inactive` 的账号立即退出。
- 服务端业务动作再次读取当前在职员工，不接受客户端传入操作人 ID。

### 数据范围

- 员工查看本人申请。
- 直属负责人查看直属员工申请。
- 当前审批人处理分配给自己的待办。
- 人事和管理员按组织查看授权申请。
- 董事长查看需要董事长审批的超过一天申请。

### 审批安全

- 当前审批人、状态和下一节点由数据库函数决定。
- 页面不能指定审批人或跳过节点。
- 每次动作携带版本号；版本不一致时拒绝重复处理。
- 退回和驳回必须填写意见。
- 所有动作写入 `approval_actions`。

### 员工管理安全

- 人事和管理员可以维护员工档案、部门、负责人及在职状态。
- 只有管理员可以分配系统角色和绑定 Auth 账号。
- 当前管理员不能停用自己或移除自己的管理员角色。
- 员工不能把自己设置为直属负责人。
- Auth 账号必须已存在，且邮箱与员工档案一致。

## 7. 本地验收

启动应用后按以下顺序测试：

1. 普通员工登录并提交一天请假。
2. 直属负责人登录并同意。
3. 行政人事登录并完成备案。
4. 再提交超过一天请假，验证中间增加董事长节点。
5. 验证非当前审批人不能处理待办。
6. 停用一个员工账号，验证不能再次登录或提交申请。
7. 验证普通员工不能读取其他无关员工的申请。

## 8. 正式上线前

- 使用独立生产项目。
- 配置自定义 SMTP、密码策略和必要的 MFA。
- 建立数据库备份和恢复演练。
- 完成真实组织数据的人工核对。
- 增加数据库集成测试和端到端测试。
- 处理依赖安全审计中尚未解决的高风险项。

## 9. 当前开发环境验收

2026 年 7 月 28 日已经完成独立的 `dexin-nebula-dev` 云端开发项目接入，区域为新加坡。开发项目包含受控测试账号以及经确认导入的内部组织、员工和产品主数据，不得作为公开演示数据库使用。

已执行：

- `202607280001_auth_organization_approvals.sql`
- `202607280002_employee_administration.sql`
- `202607280003_finance_management.sql`
- `202607280004_inventory_management.sql`
- `202607280005_customer_management.sql`
- `202607280006_roster_ready_employee_profiles.sql`
- `202607280007_private_employee_avatars.sql`
- `202607280008_product_information_management.sql`
- `202607280009_generic_approvals_expenses.sql`
- `202607290010_notifications_audit.sql`
- `202607290011_knowledge_center.sql`
- `202607290012_weekly_reports.sql`
- `202607290013_announcements.sql`
- `202607290014_warehouse_batches_imports.sql`
- `202607290015_inventory_export_audit.sql`
- 开发组织、7 个部门和 6 类角色初始化
- 4 个 Supabase Auth 测试账号及员工档案绑定
- 普通员工 → 直属负责人 → 行政人事的一天请假流程
- 普通员工 → 直属负责人 → 董事长 → 行政人事的三天请假流程
- 非当前审批人处理待办的越权拦截
- 费用报销两级审批、3 条站内通知和 3 条审计记录的事务内回滚验收

测试账号：

| 账号 | 角色 |
| --- | --- |
| `employee.dev@dxmstech.cn` | 普通员工 |
| `manager.dev@dxmstech.cn` | 部门负责人 |
| `chairman.dev@dxmstech.cn` | 董事长 |
| `hr.dev@dxmstech.cn` | 人事、管理员 |

测试密码不写入项目文件，应保存在开发者获准使用的本机密码管理器中。重新生成或交接测试账号时，应通过安全渠道更新，不得把密码补充到本文件。

## 10. 密码找回与修改

应用提供两条用户自助路径：

- `/forgot-password`：未登录用户申请密码重置邮件。
- `/account/password`：已登录用户验证当前密码后修改。

在 Supabase Dashboard 的 **Authentication → URL Configuration** 中：

1. 将 `Site URL` 设为私有运维系统中登记的正式应用 HTTPS 地址。
2. 将本地与正式回调加入 Redirect URLs：
   - `http://localhost:3000/auth/confirm`
   - `https://<application-domain>/auth/confirm`
3. 生产环境配置自定义 SMTP，不依赖 Supabase 默认邮件服务。

如果希望重置链接可在不同浏览器或设备打开，将 **Authentication → Email Templates → Reset password** 中的链接配置为：

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
  重置德馨星云密码
</a>
```

密码更新成功后，应用会执行全局退出，要求用户使用新密码重新登录。
