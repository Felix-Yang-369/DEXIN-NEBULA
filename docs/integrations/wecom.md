# 企业微信扫码登录接入

德馨星云使用企业微信自建应用扫码确认成员身份，再由服务端为已绑定的 Supabase Auth 员工建立会话。企业微信密钥和 Supabase 管理密钥只允许保存在服务端环境变量中。

## 企业微信后台配置

1. 在企业微信管理后台创建自建应用，并记录企业 ID、AgentId 和应用 Secret。
2. 将需要登录德馨星云的员工加入应用可见范围。
3. 在应用的企业微信授权登录配置中将正式应用域名登记为可信域名。
4. 将回调地址精确配置为：

   `https://<application-domain>/auth/wecom/callback`

5. 回调地址必须使用 HTTPS；本地开发仅允许 `localhost`。

## 服务端环境变量

```dotenv
WECOM_CORP_ID=wwxxxxxxxxxxxxxxxx
WECOM_AGENT_ID=1000002
WECOM_APP_SECRET=
WECOM_CALLBACK_URL=https://<application-domain>/auth/wecom/callback
SUPABASE_SERVICE_ROLE_KEY=
```

不要给以上变量添加 `NEXT_PUBLIC_` 前缀，也不要把真实值提交到 Git。

## 员工绑定规则

- 首次扫码：系统读取企业微信成员的企业邮箱，与唯一的在职员工档案匹配，并保存不可变的企业微信 `UserId` 绑定。
- 后续扫码：只通过已绑定的 `UserId` 查找员工，不再依赖可能变化的邮箱。
- 员工必须处于在职状态，并已绑定 Supabase Auth 账号。
- 同一个企业微信身份不能绑定多个员工，同一个员工也不能绑定多个企业微信身份。
- 身份首次绑定和每次成功扫码登录都会写入审计日志。

## 上线验收

1. 使用未绑定但邮箱一致的在职员工扫码，确认首次绑定并进入工作台。
2. 修改企业微信普通邮箱字段后再次扫码，确认仍能通过 `UserId` 登录。
3. 使用不在应用可见范围、已停用或未绑定 Supabase Auth 的成员扫码，确认被拒绝。
4. 修改回调 `state` 或等待十分钟后回调，确认请求失效。
5. 确认 `/audit` 中出现“企业微信身份绑定”和“企业微信扫码登录”。
6. 确认回调地址、应用可信域名、Nginx HTTPS 转发和生产环境变量完全一致。
