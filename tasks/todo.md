# Task List: 唱片柜微信小程序正式开发

## Phase 1: Contracts and Skeleton

- [x] Task 1: 初始化 monorepo 项目结构
  - Acceptance: 存在 `apps/miniprogram`、`apps/api`、`apps/tv-apk`、`packages/shared` 基础目录和 package scripts。
  - Verify: `npm install`、`npm run typecheck` 可以执行到预期阶段。
  - Files: `package.json`, `apps/*`, `packages/shared`

- [x] Task 2: 定义共享类型和 API 错误合同
  - Acceptance: 用户、会员、唱片、收藏、电视设备、分页、错误结构都有 TypeScript 类型。
  - Verify: shared package typecheck 通过。
  - Files: `packages/shared/src/*`

- [x] Task 3: 迁移 UI token
  - Acceptance: 当前原型的颜色、间距、圆角、字体层级整理成小程序可复用 token。
  - Verify: token 文件可被小程序页面引用。
  - Files: `apps/miniprogram/styles/tokens.wxss`, `packages/shared`

## Phase 2: Backend Foundation

- [x] Task 4: 初始化 NestJS API 和 Prisma
  - Acceptance: API 项目可启动，Prisma 可连接微信云托管 MySQL。
  - Verify: `npm run api:dev` 和 `npm run prisma:migrate` 可执行。
  - Files: `apps/api`, `prisma/schema.prisma`

- [x] Task 5: 建立核心数据库表
  - Acceptance: users、memberships、membership_orders、albums、collections、tv_devices、sync_events 表存在。
  - Verify: 迁移后数据库结构与规格一致。
  - Files: `prisma/schema.prisma`, `apps/api/tests`

- [x] Task 6: 实现微信登录和用户资料接口
  - Acceptance: 小程序 code 可换取后端 token；`GET /v1/me` 返回用户、会员和统计摘要。
  - Verify: API 测试覆盖成功登录和无效 code。
  - Files: `apps/api/src/auth`, `apps/api/src/users`

## Phase 3: Collections and Stats

- [ ] Task 7: 实现唱片搜索和手动创建
  - Acceptance: 可按唱片、艺人、风格、年份搜索；找不到可创建唱片资料。
  - Verify: API 测试覆盖分页、空结果和创建校验。
  - Files: `apps/api/src/albums`

- [ ] Task 8: 实现收藏 CRUD 和容量限制
  - Acceptance: 云托管 `/api/collections/*` 已支持小程序收藏持久化和分享读取；普通用户第 11 张新增失败、VIP 容量限制仍待接入。
  - Verify: API 测试覆盖云托管收藏写入/分享读取；后续补普通、VIP、过期 VIP 三种容量状态。
  - Files: `apps/api/src/collections`, `apps/api/src/membership`

- [ ] Task 9: 实现统计和收藏排行接口
  - Acceptance: 返回唱片数、艺人数、曲目数、总金额、收藏排行前 10。
  - Verify: API 测试覆盖 count 和 amount 两种排行。
  - Files: `apps/api/src/stats`

## Phase 4: Mini Program UI

- [x] Task 10: 搭建小程序 Tab 和页面路由
  - Acceptance: 首页、添加、统计、我的四个 Tab 可切换。
  - Verify: 微信开发者工具可运行，无页面路由错误。
  - Files: `apps/miniprogram/app.json`, `apps/miniprogram/pages/*`

- [x] Task 10a: 支持分享给微信好友
  - Acceptance: 首页有显式分享入口，主要页面右上角菜单可分享给微信好友。
  - Verify: 微信开发者工具中点击分享按钮或右上角菜单可触发分享卡片。
  - Files: `apps/miniprogram/services/share.js`, `apps/miniprogram/pages/*`

- [ ] Task 11: 实现首页和唱片详情卡片
  - Acceptance: 首页展示用户概览、照片墙、全部唱片搜索；封面可打开详情卡片。
  - Verify: 手测搜索、打开、切换卡片。
  - Files: `apps/miniprogram/pages/home`, `apps/miniprogram/components/album-card`

- [ ] Task 12: 实现添加流程
  - Acceptance: 添加页支持搜索、最近搜索、手动新建、批量输入入口；超额跳 VIP。
  - Verify: 普通用户超过 10 张时不能继续添加。
  - Files: `apps/miniprogram/pages/add`, `apps/miniprogram/pages/album`

- [ ] Task 13: 实现统计页
  - Acceptance: 展示统计卡片、收藏排行、分享入口。
  - Verify: 排行前 10、前三名样式、无横向溢出。
  - Files: `apps/miniprogram/pages/stats`, `apps/miniprogram/components/rank-list`

- [ ] Task 14: 实现我的页、VIP 页、教程和用户须知
  - Acceptance: 我的页展示头像编辑、普通/VIP 状态、电视绑定、平台服务；VIP 页可发起订单。
  - Verify: 普通用户提示、VIP 到期时间、教程/须知页面排版符合原型。
  - Files: `apps/miniprogram/pages/account`, `apps/miniprogram/pages/vip`, `apps/miniprogram/pages/help`

## Phase 5: VIP Payment

- [ ] Task 15: 实现会员订单和微信支付参数
  - Acceptance: 可创建包月 8 元、包年 68 元订单并返回微信支付参数。
  - Verify: API 测试覆盖订单金额、重复提交和无效 plan。
  - Files: `apps/api/src/membership`, `apps/api/src/payments`

- [ ] Task 16: 实现微信支付回调和会员续期
  - Acceptance: 支付成功后写入订单交易号，更新会员有效期；重复回调幂等。
  - Verify: 回调签名校验、幂等测试、续费叠加测试。
  - Files: `apps/api/src/payments`, `apps/api/src/membership`

- [ ] Task 17: 小程序接入支付流程
  - Acceptance: 用户点击套餐后调起微信支付；支付成功后刷新会员态。
  - Verify: 微信开发者工具 + 真机支付测试。
  - Files: `apps/miniprogram/pages/vip`, `apps/miniprogram/services/api`

## Phase 6: TV APK

- [ ] Task 18: 实现电视绑定码接口
  - Acceptance: 小程序可生成短期绑定码；APK 可用绑定码绑定设备。
  - Verify: 绑定码过期、重复使用和解绑测试。
  - Files: `apps/api/src/tv`

- [ ] Task 19: 实现 APK 展示数据接口
  - Acceptance: 返回 profile、photoWall、featuredAlbums、stats；普通/过期用户最多返回 10 张。
  - Verify: API 测试覆盖 active VIP、expired VIP、ordinary user。
  - Files: `apps/api/src/tv`, `apps/api/src/collections`

- [ ] Task 20: 搭建 TV APK 壳
  - Acceptance: APK 可输入绑定码并展示照片墙、详情卡片、统计。
  - Verify: Android TV 模拟器或目标电视安装运行。
  - Files: `apps/tv-apk`

## Phase 7: Verification and Launch

- [ ] Task 21: 全链路测试
  - Acceptance: 登录、添加、搜索、统计、支付、会员到期、APK 同步主路径通过。
  - Verify: API test + 小程序真机 + APK 真机/模拟器。
  - Files: `tests/e2e`, `apps/*`

- [ ] Task 22: 上线准备
  - Acceptance: 小程序隐私协议、用户须知、支付商户配置、服务器域名、APK 签名准备完成。
  - Verify: 微信审核前检查清单通过。
  - Files: `docs`, `apps/miniprogram`, deployment config

## Cross-Cutting MVP Scope Notes

- 首发会员：全平台前 10 个成功注册账号自动获得从注册时起 1 年 VIP；后端通过事务化注册序号保证名额不超发。

- 唱片手动创建：用户创建的唱片资料不需要平台审核，创建后可直接用于自己的收藏；后端必须记录 `createdBy`、创建时间和来源。
- 最小运营能力：第一版不做完整后台管理端，但上线前必须能通过 Prisma Studio/数据库控制台查询用户、订单、会员和收藏记录。
- 会员人工修正：第一版需要准备受保护的内部脚本或受限接口，用于处理支付异常、补发会员、延长有效期等少量人工运营场景。
- 审计日志：支付回调、会员状态变更、电视绑定变更、人工会员修正都需要记录操作来源、原因和时间。
- Post-MVP：完整后台管理、内容审核、举报处理、资料合并和可视化运营面板后置到第二阶段。
