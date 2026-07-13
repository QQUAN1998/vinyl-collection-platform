# Spec: 唱片柜微信小程序产品与开发规格

## 当前假设

1. 目标是把已确认的静态原型转成可上线微信小程序，而不是继续做纯 HTML 原型。
2. 前端采用原生微信小程序，UI 风格沿用当前原型的米白底、橄榄绿、浅黄色会员态和克制圆角。
3. 后端推荐采用 Node.js + PostgreSQL，便于后续做电视端、管理后台、订单和同步能力。
4. 微信登录、微信支付、会员有效期和收藏上限都由后端校验，前端只做展示和提示。
5. 电视端先按“绑定设备 + 拉取展示数据”的方式设计，具体电视运行载体后续再定。
6. 当前不生成正式源码，先确认规格、接口和数据模型。

## 当前执行路线

2026-07-12 起，MVP 先按微信云托管落地：小程序通过 `wx.cloud.callContainer`
调用云托管服务 `express-i2ts`，后端使用 NestJS + Prisma + MySQL（数据库
`vinyl_cabinet`）。长期是否迁回 PostgreSQL 或独立云服务器，放到后续阶段评估。

## Objective

构建一个面向个人唱片收藏者的微信小程序，用于记录、展示、搜索、统计和同步唱片收藏。

核心目标：

- 用户可以维护自己的唱片柜，包含封面、艺人、年份、风格、价格、曲目和收藏日期。
- 普通用户最多可收藏 10 张唱片。
- VIP 用户支持手机端和电视端双端权益，收藏上限不超过 10,000 张。
- 全平台前 10 个成功注册的账号从注册时间起自动获得 1 年 VIP；第 11 个及以后不自动赠送。
- VIP 价格为包月 8 元、包年 68 元。
- “我的”页展示头像、用户名、收藏数量、会员状态、到期日期或普通用户容量提示。
- 电视端可绑定用户账号，并同步照片墙、详情卡片和统计展示。

成功标准：

- 原型中的首页、添加、统计、我的、VIP、教程、须知、详情卡片体验在小程序端完整复刻。
- 普通用户超过 10 张时无法继续新增，并引导到 VIP 页面。
- VIP 支付成功后，会员状态和到期时间生效。
- 所有容量限制由服务端兜底，不能只依赖前端。

## Recommended Tech Stack

### 小程序前端

- 微信原生小程序：WXML + WXSS + TypeScript
- 状态管理：页面局部状态 + 全局 `app.globalData` 保存登录态和会员态
- 网络请求：统一 request wrapper，处理 token、错误提示和重试
- 图片资源：用户上传走对象存储，默认封面走静态资源或 CDN

### 后端

- Node.js + Fastify 或 NestJS
- PostgreSQL
- Prisma ORM
- Redis 可选：用于验证码、短期绑定码、限流和缓存
- 对象存储：腾讯云 COS 或微信云存储

### 微信能力

- 微信登录：`wx.login` -> 后端换取 `openid`
- 微信支付：后端创建订单，支付回调更新会员
- 订阅消息可选：会员到期提醒、电视同步异常提醒

### 可替代快速方案

如果目标是最快上线 MVP，可以改用微信云开发：

- 云数据库替代 PostgreSQL
- 云函数替代 Node API
- 云存储保存封面

代价是后续电视端、复杂报表、管理后台和订单审计的可控性较弱。

## Page Structure

### Tab 页面

- `pages/home/index`：首页，包含用户概览、照片墙、全部唱片搜索。
- `pages/add/index`：添加唱片，包含搜索、最近搜索、最近加入、手动新建入口。
- `pages/stats/index`：统计页，包含收藏统计、收藏排行、分享海报入口。
- `pages/account/index`：我的页，包含资料卡、电视绑定、平台服务、设置。

### 二级页面

- `pages/album/detail`：唱片详情和编辑入口。
- `pages/album/edit`：编辑收藏信息。
- `pages/album/manual`：手动新建唱片。
- `pages/album/batch`：批量输入和匹配结果。
- `pages/vip/index`：VIP 会员页，展示权益、套餐和开通按钮。
- `pages/account/edit`：编辑头像、用户名、简介。
- `pages/help/guide`：使用教程。
- `pages/help/notice`：用户须知。
- `pages/tv/bind`：电视绑定码或扫码绑定。

### 组件

- `components/album-card`：唱片封面卡片。
- `components/album-modal`：唱片详情卡片弹层。
- `components/search-box`：统一搜索框。
- `components/rank-list`：排行列表。
- `components/profile-card`：我的页资料卡。
- `components/vip-plan-card`：会员套餐卡。
- `components/bottom-safe-area`：底部安全区。

## Product Rules

### 收藏容量

- 普通用户最多可收藏 10 张。
- VIP 用户最多可收藏 10,000 张。
- 超过容量时：
  - 前端提示并跳转 VIP 页。
  - 后端返回 `COLLECTION_LIMIT_REACHED`，防止绕过前端。

### 会员权益

- 包月会员：8 元，开通后有效期增加 1 个月。
- 包年会员：68 元，开通后有效期增加 1 年。
- 若用户当前仍在会员期内，续费从当前到期日往后叠加。
- 到期后：
  - 已收藏数据保留。
  - 超出普通额度时不能新增。
  - 电视端同步可限制为只读展示，具体策略待确认。

### 稀有度

按价格分档：

- N：经典唱片
- R：珍藏唱片
- SR：白银唱片
- SSR：银钻唱片
- UR：金钻唱片

具体价格阈值沿用当前原型逻辑，后续可放到服务端配置。

### 搜索

首页“全部唱片”支持一级搜索：

- 唱片名
- 艺人
- 风格
- 年代

添加页搜索用于查找可添加唱片，并保存最近搜索，最多 3 个。

## Data Model

### users

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | 内部用户 ID |
| openid | string | 微信用户唯一标识 |
| unionid | string? | 多端统一身份，可选 |
| nickname | string | 用户名 |
| avatarUrl | string? | 头像 |
| bio | string? | 简介 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### memberships

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | 会员记录 ID |
| userId | uuid | 用户 ID |
| plan | enum | `MONTHLY` / `YEARLY` |
| status | enum | `ACTIVE` / `EXPIRED` / `CANCELLED` |
| startsAt | datetime | 生效时间 |
| expiresAt | datetime | 到期时间 |
| createdAt | datetime | 创建时间 |

### membership_orders

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | 内部订单 ID |
| userId | uuid | 用户 ID |
| plan | enum | `MONTHLY` / `YEARLY` |
| amountCents | int | 800 / 6800 |
| wxTransactionId | string? | 微信交易号 |
| status | enum | `PENDING` / `PAID` / `FAILED` / `REFUNDED` |
| paidAt | datetime? | 支付完成时间 |
| createdAt | datetime | 创建时间 |

### albums

平台唱片资料库，可由用户添加后沉淀。

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | 唱片 ID |
| title | string | 唱片名 |
| artist | string | 艺人 |
| year | int? | 年份 |
| genre | string? | 风格 |
| region | string? | 地区 |
| coverUrl | string? | 封面 |
| tracks | json | 曲目 |
| createdBy | uuid? | 创建用户 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### collections

用户自己的收藏。

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | 收藏 ID |
| userId | uuid | 用户 ID |
| albumId | uuid | 唱片 ID |
| priceCents | int? | 购入价 |
| quantity | int | 数量 |
| condition | string? | 品相 |
| source | string? | 来源 |
| collectedAt | date? | 收藏日期 |
| note | string? | 备注 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

### tv_devices

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | 设备 ID |
| userId | uuid | 绑定用户 |
| deviceName | string | 设备名称 |
| bindCode | string? | 短期绑定码 |
| status | enum | `ACTIVE` / `UNBOUND` |
| lastSyncedAt | datetime? | 上次同步 |
| createdAt | datetime | 创建时间 |

### sync_events

| Field | Type | Notes |
| --- | --- | --- |
| id | uuid | 同步记录 ID |
| userId | uuid | 用户 ID |
| deviceId | uuid? | 电视设备 |
| type | enum | `COLLECTION_UPDATED` / `PROFILE_UPDATED` / `MEMBERSHIP_UPDATED` |
| payload | json | 同步摘要 |
| createdAt | datetime | 创建时间 |

## API Contract Draft

统一错误格式：

```json
{
  "error": {
    "code": "COLLECTION_LIMIT_REACHED",
    "message": "普通用户最多收藏 10 张唱片",
    "details": {}
  }
}
```

### Auth

- `POST /v1/auth/wechat-login`
  - Input: `{ code: string }`
  - Output: `{ token, me }`

### Me

- `GET /v1/me`
  - Output: `{ user, membership, stats, tvDevices }`
- `PATCH /api/me`
  - Input: `{ nickname?, avatarUrl?, bio? }`
  - Output: `{ user }`

### Share

- 小程序需支持分享给微信好友。
- 首版分享入口包括首页显式分享按钮和页面右上角分享菜单。
- 默认分享落点为 `pages/home/index`，分享文案使用 `David的唱片柜`。
- 后续唱片详情页完成后，单张唱片卡片需支持分享到对应详情页。

### Albums

- `GET /api/albums/search?query=&page=&pageSize=`
  - Output: paginated album list
- `POST /api/albums`
  - Input: album fields
  - Output: created album

### Collections

- `GET /api/collections?query=&artist=&genre=&decade=&page=&pageSize=`
  - Output: paginated user collections
- `POST /api/collections`
  - Input: `{ albumId, priceCents?, quantity?, condition?, source?, collectedAt?, note? }`
  - Output: created collection
  - Error: `COLLECTION_LIMIT_REACHED`
- `PATCH /api/collections/:id`
  - Input: partial collection fields
  - Output: updated collection
- `DELETE /api/collections/:id`
  - Output: `{ success: true }`

### Stats

- `GET /api/stats/summary`
  - Output: `{ albumCount, artistCount, trackCount, totalAmountCents }`
- `GET /api/stats/rankings?metric=count|amount&pageSize=10`
  - Output: top artists list

### Membership

- `GET /api/membership`
  - Output: `{ isVip, plan?, expiresAt?, limits }`
- `POST /api/membership/orders`
  - Input: `{ plan: "MONTHLY" | "YEARLY" }`
  - Output: `{ orderId, wxPayParams }`
- `POST /api/membership/wechat-callback`
  - 微信支付回调，仅服务端访问。

### TV

- `POST /api/tv/bind-code`
  - Output: `{ bindCode, expiresAt }`
- `POST /api/tv/bind`
  - Input: `{ bindCode, deviceName }`
  - Output: `{ device }`
- `GET /api/tv/display-data`
  - Output: `{ profile, photoWall, featuredAlbums, stats, updatedAt }`
- `POST /api/tv/sync`
  - Output: `{ syncedAt }`

## Commands

当前还没有正式源码仓库。建议源码初始化后采用：

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

小程序端：

```bash
npm run miniprogram:dev
npm run miniprogram:build
```

后端：

```bash
npm run api:dev
npm run api:test
npm run prisma:migrate
```

## Project Structure

建议后续源码结构：

```text
apps/
  miniprogram/          微信小程序前端
  api/                  Node 后端 API
  tv/                   电视端展示应用，待运行环境确认
packages/
  shared/               共享类型、常量、接口 schema
  ui-tokens/            UI token 和设计常量
docs/
  mini-program-development-spec.md
prisma/
  schema.prisma
tests/
  e2e/
```

## Code Style

示例接口类型风格：

```ts
type MembershipPlan = "MONTHLY" | "YEARLY";

interface MembershipStatus {
  isVip: boolean;
  plan?: MembershipPlan;
  expiresAt?: string;
  limits: {
    collectionLimit: number;
    currentCollectionCount: number;
  };
}
```

约定：

- TypeScript 类型使用 `PascalCase`。
- API 字段使用 `camelCase`。
- 数据库字段由 ORM 映射，代码层统一 `camelCase`。
- 枚举值使用 `UPPER_SNAKE_CASE`。
- 金额用分保存，不用浮点数。
- 时间统一 ISO 字符串传输。

## Testing Strategy

### 小程序前端

- 组件级测试：搜索、会员态资料卡、VIP 套餐卡、收藏卡片。
- 页面级手测：微信开发者工具 + 真机。
- 重点真机尺寸：iPhone SE、小屏 Android、常规 iPhone、较大屏。

### 后端

- 单元测试：容量限制、会员到期、续费叠加、稀有度计算。
- API 测试：登录、添加收藏、超过上限、支付回调、电视绑定。
- 数据库测试：迁移、唯一约束、分页。

### 集成测试

- 普通用户添加第 11 张失败。
- VIP 支付成功后可继续添加。
- VIP 到期后已收藏保留，但新增受限。
- 电视端绑定后能获取展示数据。

## Boundaries

Always:

- 所有用户输入在 API 边界校验。
- 收藏上限必须由后端校验。
- 支付结果只信任微信支付回调，不信任前端支付成功状态。
- 列表接口必须分页。
- 金额用分保存。

Ask first:

- 是否采用微信云开发替代独立后端。
- 电视端具体运行形态。
- 是否需要管理后台。
- 是否开放用户之间分享公开主页。
- VIP 到期后电视端是否继续展示超额收藏。

Never:

- 不在前端硬编码支付成功。
- 不在代码里保存微信支付密钥。
- 不允许用户直接写入他人收藏。
- 不删除用户收藏数据作为会员到期处理。

## Implementation Phases

### Phase 1: 小程序骨架

- 初始化小程序项目。
- 配置页面路由和底部 Tab。
- 迁移当前 UI token。
- 搭建首页、添加、统计、我的静态页面。

### Phase 2: 后端和数据模型

- 初始化 API 项目。
- 建表：用户、唱片、收藏、会员、订单、电视设备。
- 实现微信登录。
- 实现收藏 CRUD 和容量限制。

### Phase 3: 小程序联调

- 接入登录态。
- 首页、添加、统计、我的页接真实接口。
- 加入加载、空状态、错误状态。

### Phase 4: VIP 和支付

- 会员页接订单接口。
- 接微信支付。
- 支付回调更新会员有效期。
- 普通/VIP 容量限制联调。

### Phase 5: 电视端同步

- 设计电视绑定流程。
- 实现展示数据接口。
- 电视端读取照片墙、详情卡片和统计。

### Phase 6: 测试和上线

- 微信开发者工具检查。
- 真机测试。
- 支付测试。
- 安全检查。
- 提交微信审核。

## Open Questions

1. 技术路线是否采用“独立后端 + PostgreSQL”，还是为了快速上线改用微信云开发？
2. 电视端是微信小程序、浏览器 Web 页面、还是电视 App/WebView？
3. 唱片资料库是否需要平台统一审核，还是用户可自由创建？
4. VIP 到期后，电视端是否继续展示超过 10 张的已收藏内容？
5. 是否需要后台管理端处理用户、订单、内容审核和数据修正？

## Confirmed Decisions

以下决策优先级高于上方 `Open Questions` 中的旧问题记录：

1. 电视端确定为 APK。
2. APK 与小程序共享同一后端账号、会员状态和收藏数据。
3. VIP 到期后，电视端不继续展示超过 10 张的收藏内容。
4. 普通用户和过期 VIP 在小程序、后端、电视端都按 10 张展示/新增限制执行。
5. 电视端展示数据由后端接口裁剪，不能让 APK 本地自行决定是否展示超额内容。

## Backend Recommendation

基于当前产品情况，推荐采用独立后端方案：

- Node.js + NestJS
- PostgreSQL
- Prisma ORM
- Redis
- 腾讯云 COS 或兼容 S3 的对象存储
- 微信支付服务端回调
- APK 使用同一套 REST API

不推荐把正式版本完全做在微信云开发上，原因：

- 电视 APK 不在微信小程序运行环境内，独立后端更自然。
- 会员订单、支付回调、电视绑定、同步裁剪和后续后台管理都需要稳定服务端边界。
- PostgreSQL 更适合后续做统计排行、订单审计、管理后台和数据修正。
- APK 版本升级和小程序版本升级可以解耦，只要 API 合同稳定即可。

云开发仍可作为快速验证方案，但不作为正式上线推荐方案。

## MVP Scope Update

以下决策优先级高于上方 `Open Questions` 中的旧问题记录：

1. 用户手动创建唱片资料不需要平台审核，创建后可直接用于自己的收藏。
2. 手动创建的唱片资料需要记录 `createdBy`、创建时间和来源，便于后续排查、合并或治理。
3. 第一版不做完整后台管理端，不把用户管理、内容审核、订单管理做成独立后台页面。
4. 第一版保留最小运营能力：数据库查看、订单查询、会员状态人工修正、支付和会员变更日志审计。
5. 内容审核、举报处理、资料合并、可视化管理后台作为 post-MVP Phase 2。

## Minimal Operations For MVP

- 数据查看：使用 Prisma Studio 或数据库控制台查看用户、订单、会员和收藏记录。
- 订单排查：后端保留订单号、微信交易号、支付状态、回调原始状态和处理结果。
- 会员修正：提供受保护的内部脚本或受限接口，用于人工补发、延长或修正会员状态。
- 审计日志：所有会员修正、支付回调处理和电视端绑定变更都记录操作者、原因和时间。
- 数据备份：上线前准备 PostgreSQL 定时备份和对象存储备份策略。

## Remaining Open Questions

1. TV APK 第一版采用原生 Android/Kotlin 还是轻量 WebView 壳；当前推荐先原生 Android/Kotlin，电视端交互更稳定。
2. 是否需要公开分享主页、社交传播或资料举报入口；当前建议后置到第一版上线后评估。
