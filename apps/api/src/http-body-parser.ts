import type { NestExpressApplication } from "@nestjs/platform-express";

const DEFAULT_API_BODY_LIMIT = "2mb";

export function getApiBodyLimit(): string {
  return process.env.API_BODY_LIMIT ?? DEFAULT_API_BODY_LIMIT;
}

export function configureHttpBodyParsers(app: NestExpressApplication): void {
  const limit = getApiBodyLimit();

  app.useBodyParser("json", { limit });
  app.useBodyParser("urlencoded", { limit, extended: true });
}
