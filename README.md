# Vinyl Collection Platform

微信小程序、共享后端和电视 APK 的正式工程。已确认的交互原型保留在
`outputs/vinyl-mini-program-prototype`，正式代码按阶段迁移到 `apps`。

## Workspace

- `apps/miniprogram`: 原生微信小程序
- `apps/api`: Node.js API
- `apps/tv-apk`: 电视 APK
- `packages/shared`: 三端共享的类型和业务规则

## Commands

```powershell
npm.cmd install
npm.cmd run prisma:validate
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run api:dev
npm.cmd run start --workspace @vinyl/api
```

API 默认监听 `http://127.0.0.1:3000`，当前提供 `/health` 和
`/v1/system/info` 两个基础端点。开发前将 `.env.example` 复制为
`apps/api/.env` 并配置 PostgreSQL 连接；开发库使用 `npm.cmd run prisma:migrate`，
部署环境使用 `npm.cmd run prisma:deploy`。
