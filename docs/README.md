# 德馨星云文档中心

这里保存产品、业务流程、开发、系统接入、运维和版本记录。项目介绍与本地启动方式见根目录 [README.md](../README.md)。

## 产品

- [产品需求基线](./product/requirements.md)：目标、用户、范围和验收原则
- [文件中心需求](./product/file-center-requirements.md)：文件分类、权限、NAS 存储、生命周期和验收标准
- [版本路线图](./product/roadmap.md)：当前优先级和后续规划
- [角色与权限](./product/user-roles.md)：角色、页面、操作和敏感字段范围
- [色彩系统](./product/color-system.md)：品牌颜色和使用原则

## 业务流程

- [统一审批、请假与费用报销](./processes/approval.md)

## 开发

- [架构与产品边界](./development/architecture.md)
- [开发与安全规范](./development/coding-standards.md)
- [测试与完成标准](./development/testing.md)

## 系统接入

- [Supabase](./integrations/supabase.md)
- [企业微信扫码登录](./integrations/wecom.md)
- [DeepSeek](./integrations/deepseek.md)
- [微信小程序认证](./integrations/miniprogram-auth.md)
- [绿联 NAS 文件中心](./integrations/nas-webdav.md)

## 运维

- [部署与回滚](./operations/deployment.md)
- [域名与 HTTPS](./operations/domains.md)
- [历史 Nginx 配置](../deploy/README.md)

## 安全

- [通知与操作审计](./security/notifications-and-audit.md)

## 发布记录

- [下一版本（尚未发布）](./releases/next.md)
- [2026-08-12 生产版本](./releases/2026-08-12-production.md)

## 文档维护规则

- README 只保留项目入口和当前事实，详细内容放在对应专题目录。
- 已上线版本写入 `releases/`，后续计划写入 `product/roadmap.md`。
- 外部服务接入放入 `integrations/`，域名、部署和回滚放入 `operations/`。
- 功能、权限、数据模型或运行方式变化时，同步更新对应文档。
