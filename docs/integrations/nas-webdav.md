# 绿联 NAS 文件中心接入

## 架构

文件中心采用“Supabase 管权限和元数据，NAS 保存文件正文”的模式：

```text
员工浏览器
  → 德馨星云 Next.js 服务端
    → Supabase：登录身份、文件元数据、RLS 权限、审计日志
    → Tailscale 私网 → 绿联 NAS WebDAV：文件正文
```

浏览器不能直接连接 NAS，也不能获得 WebDAV 地址、账号或密码。上传和下载都先经过德馨星云服务端的登录与文件权限校验。

## NAS 前置条件

- 共享文件夹：`德馨星云`
- 专用账号：`nebula-sync`，只允许读写该共享文件夹
- WebDAV HTTPS：端口 `5006`
- NAS 和阿里云 ECS 已加入同一个 Tailscale 网络
- ECS 能通过 NAS 的 Tailscale IP 访问 WebDAV，`PROPFIND` 返回 `207`

专用账号应使用 Standard User，不要授予 NAS Administrator 权限。

## 服务端环境变量

在阿里云 ECS 的生产环境文件中设置，不能提交真实密码：

```env
NAS_WEBDAV_URL=https://NAS_TAILSCALE_IP:5006
NAS_WEBDAV_ROOT=/德馨星云
NAS_WEBDAV_USERNAME=nebula-sync
NAS_WEBDAV_PASSWORD=REPLACE_WITH_CURRENT_PASSWORD
NAS_WEBDAV_TIMEOUT_MS=120000
NAS_WEBDAV_TLS_REJECT_UNAUTHORIZED=true
NAS_WEBDAV_CA_CERT=
```

首选给 NAS 配置可信证书，或把签发 NAS 证书的 CA PEM 放入 `NAS_WEBDAV_CA_CERT`。如果 NAS 目前只能提供自签名证书，可以在确认连接仅经过 Tailscale 私网后，临时设置：

```env
NAS_WEBDAV_TLS_REJECT_UNAUTHORIZED=false
```

该兼容设置仍加密传输，但不验证 NAS 证书身份，应在证书配置完成后恢复为 `true`。

## 文件路径

应用在共享文件夹内使用以下结构：

```text
德馨星云/
└── {organization_id}/
    └── {YYYY-MM}/
        └── {random_uuid}.{extension}
```

Supabase 的 `business_documents.storage_path` 只保存共享文件夹内的相对路径，不保存密码或可公开访问的下载链接。

## 一致性与故障处理

- 上传顺序：先写 NAS，再写 Supabase 元数据。
- 元数据写入失败：立即删除刚上传的 NAS 文件作为回滚。
- NAS 不可用：页面显示明确错误，不创建数据库记录。
- 下载顺序：先由 Supabase RLS 确认当前员工可查看，再由服务端读取 NAS，并记录下载审计。
- 归档只改变业务状态，不删除文件正文，避免误删和便于审计。

## 上线验收

1. 使用有上传权限的测试账号上传一个小型 PDF。
2. 在 NAS 的对应年月目录确认文件出现。
3. 在文件中心下载并确认文件名、内容和格式正确。
4. 使用无权查看该文件的账号访问下载地址，确认被拒绝。
5. 暂停 NAS WebDAV 后再次上传，确认页面显示可重试错误且 Supabase 没有新增元数据。
6. 恢复 WebDAV，确认上传和下载恢复。
7. 检查 `audit_logs` 中存在上传和下载记录。

## 回滚

应用回滚到旧版本前，必须确认旧版本仍使用 Supabase Storage。由于本次启用后文件正文只写 NAS，旧版本不能下载这些新文件，因此生产回滚应同时保留本版本构建，或先完成 NAS 文件的受控迁移。不要直接删除 NAS 文件或 `business_documents` 元数据。
