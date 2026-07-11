# Security Notes

## Deferred dependency advisory

- Advisory: `GHSA-92pp-h63x-v22m`
- Affected dependency: `@hono/node-server@1.19.11`, nested under the Prisma CLI
- Severity: moderate
- Runtime reachability: development-only; the Vinyl API does not import or run this server
- Current mitigation: do not expose `prisma dev` outside the local development machine
- Reason for deferral: npm's suggested fix downgrades Prisma 7 to Prisma 6, which is a breaking change
- Review trigger: upgrade when Prisma publishes a release that includes `@hono/node-server >=1.19.13`
- Review by: 2026-08-11
