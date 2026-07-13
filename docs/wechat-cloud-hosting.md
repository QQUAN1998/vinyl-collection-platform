# WeChat Cloud Hosting Deployment

This project now supports the WeChat Cloud Hosting path:

```text
Mini Program
  -> wx.cloud.callContainer
  -> Cloud Hosting service: express-i2ts
  -> NestJS API
  -> MySQL: vinyl_cabinet
```

## Cloud Hosting Environment

Configure these variables on the `express-i2ts` service:

```text
PORT=3000
HOST=0.0.0.0
MYSQL_ADDRESS=10.10.108.203:3306
MYSQL_USERNAME=root
MYSQL_PASSWORD=<existing-cloud-hosting-password>
MYSQL_DATABASE=vinyl_cabinet
AUTH_TOKEN_SECRET=<at-least-32-random-characters>
```

`DATABASE_URL` is still supported, but it is optional when the WeChat Cloud
Hosting `MYSQL_*` variables are present. If both are set, `DATABASE_URL` wins.

Do not commit the real MySQL password or auth secret.

## Mini Program Cloud Config

The mini program uses:

```js
wx.cloud.init({
  env: "prod",
  traceUser: true
});

wx.cloud.callContainer({
  config: { env: "prod" },
  path: "/api/collections/me",
  header: { "X-WX-SERVICE": "express-i2ts" }
});
```

The service name and environment are defined in `apps/miniprogram/app.js` under
`globalData.cloud`.

## API Endpoints For MVP

```text
GET    /api/me
GET    /api/collections/me
POST   /api/collections
PATCH  /api/collections/:id
DELETE /api/collections/:id
GET    /api/collections/shared/:ownerId
```

All `/api/*` mini program endpoints require the WeChat cloud openid header that
Cloud Hosting injects for `callContainer` requests. Local tests use
`x-vinyl-dev-openid`.

## Local Verification

```powershell
npm.cmd run prisma:validate
npm.cmd run miniprogram:test
npm.cmd run test --workspace @vinyl/api
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

## Deploy Notes

1. Make sure the MySQL database `vinyl_cabinet` exists with `utf8mb4`.
2. Set the environment variables above on the cloud service.
3. Deploy from the repository root so `Dockerfile` is included.
4. The container start command runs `prisma migrate deploy` before starting the API.
5. After the cloud service is healthy, upload a new mini program version so the
   `wx.cloud.callContainer` client is included.

CLI deploy command after `tcb login`:

```powershell
npx.cmd -y -p @cloudbase/cli tcb cloudrun deploy `
  -e prod `
  -s express-i2ts `
  --port 3000 `
  --source . `
  --force
```
