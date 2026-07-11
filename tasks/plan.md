# Implementation Plan: 唱片柜微信小程序 + 后端 + 电视 APK

## Overview

把当前已确认的静态原型落地为生产级系统：微信小程序负责手机端收藏管理，独立后端负责登录、收藏、会员、支付、同步和数据裁剪，电视端以 APK 形式读取同一后端展示数据。普通用户和过期 VIP 限制为 10 张收藏；有效 VIP 上限不超过 10,000 张。

## Architecture Decisions

- 小程序前端采用原生微信小程序 + TypeScript，最大限度贴近微信审核和运行环境。
- 后端采用 Node.js + NestJS + PostgreSQL + Prisma，适合微信支付、APK 同步、订单审计和后续后台扩展。
- Redis 用于短期电视绑定码、接口限流、同步状态缓存。
- 对象存储使用腾讯云 COS 或兼容 S3 服务保存用户上传封面。
- APK 只消费后端展示接口，不直接连接数据库。
- VIP 到期后，服务端对小程序列表和 APK 展示数据统一裁剪到普通用户 10 张额度。
- 前 10 个成功注册的账号自动赠送 1 年 VIP，注册序号分配与赠送必须在同一数据库事务中完成，避免并发超发。

## Dependency Graph

```text
Shared contracts and rules
  -> Database schema and migrations
    -> Auth and membership services
      -> Collection APIs with capacity enforcement
        -> Mini program API client and pages
        -> APK display API
          -> TV APK implementation
      -> Payment order and callback services
```

## Phase 1: Contracts and Project Skeleton

- Define shared TypeScript contracts for user, album, collection, membership, TV device, errors, pagination.
- Initialize monorepo structure for `apps/miniprogram`, `apps/api`, `apps/tv-apk`, and `packages/shared`.
- Establish design tokens from current prototype.

### Checkpoint: Foundation Ready

- Shared contracts compile.
- Project scripts run.
- No app feature code depends on undocumented response shapes.

## Phase 2: Backend Foundation

- Implement PostgreSQL schema and Prisma migrations.
- Implement WeChat login and token auth.
- Implement user profile and membership status APIs.
- Implement centralized error format and request validation.

### Checkpoint: Backend Core Ready

- API tests pass for auth, profile, membership status, and errors.
- Database migrations can run from scratch.

## Phase 3: Collections and Search

- Implement album search and manual album creation.
- Implement collection list, add, edit, delete.
- Enforce ordinary user 10-item limit and VIP 10,000-item limit in service layer.
- Implement stats summary and collection ranking.

### Checkpoint: Collection Flow Ready

- Ordinary user cannot add the 11th collection.
- VIP user can add beyond 10.
- Stats and rankings are based on user-owned collections.

## Phase 4: Mini Program UI

- Build tab pages: home, add, stats, account.
- Build secondary pages: VIP, guide, notice, edit profile, manual add, detail.
- Migrate UI from prototype into WXML/WXSS components.
- Connect pages to real API client.

### Checkpoint: Mini Program MVP Ready

- Main flows work in WeChat DevTools.
- UI matches approved prototype style.
- Empty, loading, and error states exist.

## Phase 5: VIP Payment

- Implement membership order creation.
- Integrate WeChat Pay parameters for mini program.
- Implement payment callback verification.
- Extend membership expiry from current active expiry when renewing.
- Reflect membership state in mini program and API limits.

### Checkpoint: Billing Ready

- Test payment flow creates paid order and active membership.
- Failed or spoofed frontend payment state does not grant VIP.
- Expired VIP falls back to ordinary limit.

## Phase 6: TV APK Sync

- Implement bind-code flow for APK.
- Implement APK display data endpoint.
- Server returns at most 10 collections for ordinary/expired users, and up to VIP limit for active VIP.
- Build APK display shell and bind flow.

### Checkpoint: APK Ready

- APK can bind to a user account.
- APK displays photo wall, detail card data, and stats from API.
- Expired VIP does not show beyond 10 items.

## Phase 7: Verification and Launch

- Run unit, API, and integration tests.
- Test mini program in WeChat DevTools and real devices.
- Test APK on target Android TV devices.
- Test payment callback and order idempotency.
- Prepare privacy policy, user notice, and WeChat submission assets.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| WeChat Pay callback errors | High | Use idempotent callbacks and verify signatures server-side |
| APK and mini program display different data | High | Both consume same backend contract; server performs limit裁剪 |
| User-uploaded cover images are unsafe or oversized | Medium | Validate file type/size and route through object storage |
| Album data quality becomes inconsistent | Medium | Track `createdBy`; add admin review later if needed |
| Scope grows into marketplace/social network | Medium | Keep MVP to personal collection and display only |

## Confirmed Scope Updates

- 用户手动创建唱片资料不需要平台审核；创建后可直接用于自己的收藏，并记录 `createdBy`、创建时间和来源。
- 第一版不做完整后台管理端；MVP 只保留最小运营能力，包括数据库查看、订单查询、会员人工修正、支付和会员变更审计日志。
- 完整后台管理、内容审核、资料合并、举报处理放到 post-MVP Phase 2。

## Open Questions

- APK 用原生 Android/Kotlin 还是轻量 WebView 壳？推荐先原生 Android/Kotlin，若 TV UI 变化很频繁可考虑 WebView。
