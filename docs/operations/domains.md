# 域名与 HTTPS 部署

## 域名职责

| 域名 | 用途 | 会话与数据 |
| --- | --- | --- |
| `app.nebula.dexinmiaosheng.cn` | 德馨星云业务系统 | 内部账号、业务数据、Supabase 和企业微信回调 |
| `nebula.dexinmiaosheng.cn` | 德馨星云介绍站 | 公开内容，不承载内部会话 |

介绍站中的“进入德馨星云”按钮应链接到 `https://app.nebula.dexinmiaosheng.cn/login`。不将介绍站整站重定向到业务系统。

## 上线顺序

1. 确认 `dexinmiaosheng.cn` 备案已完成，且域名实名与服务器备案接入符合当前阿里云要求。
2. 为两个子域名分别添加 DNS 解析；同机部署时可以都指向同一 ECS 公网 IP。
3. 为两个子域名签发 HTTPS 证书，可使用两张单域名证书或一张包含两者的证书。
4. Nginx 建立两个独立 `server` 配置，按 `server_name` 分流，不依赖端口暴露给用户。
5. 将业务系统生产环境的 `NEXT_PUBLIC_APP_URL` 设为 `https://app.nebula.dexinmiaosheng.cn`。
6. 在 Supabase Authentication 中设置 Site URL 和 Redirect URL。
7. 在企业微信中设置可信域名与精确回调地址。
8. 先验证 HTTPS、密码重置、登录和关键权限，再开放对内使用。

## Nginx 分流原则

`app.nebula.dexinmiaosheng.cn` 的 HTTPS 入口反向代理到德馨星云 PM2 进程，当前约定为 `127.0.0.1:3103`。

`nebula.dexinmiaosheng.cn` 必须指向介绍站的独立静态目录或独立进程。介绍站的实际发布目录或端口确定后，再写入生产 Nginx 配置，不使用未确定的占位端口。

HTTP 端口只用于将各自域名重定向到对应的 HTTPS 地址。对未知 Host 保持默认拒绝，避免通过任意域名进入内部系统。

## 生产回调

```dotenv
NEXT_PUBLIC_APP_URL=https://app.nebula.dexinmiaosheng.cn
WECOM_CALLBACK_URL=https://app.nebula.dexinmiaosheng.cn/auth/wecom/callback
```

Supabase Authentication：

```text
Site URL:     https://app.nebula.dexinmiaosheng.cn
Redirect URL: https://app.nebula.dexinmiaosheng.cn/auth/confirm
```

`nebula.dexinmiaosheng.cn` 不加入生产身份回调列表。

## 验收清单

- 两个域名都使用有效 HTTPS，且不会被导向对方的首页。
- 介绍站只展示公开内容，不读取业务系统 Cookie 或内部 API。
- 业务系统登录、退出、密码重置和企业微信扫码回调正常。
- 登录后的 Dashboard、CRM、库存、财务和文件下载均使用系统域名。
- Nginx 传递正确的 `Host`、`X-Forwarded-For` 和 `X-Forwarded-Proto`。
- 公网 IP 不再作为对外正式入口。
