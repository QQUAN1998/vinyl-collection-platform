import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import { configureHttpBodyParsers } from "./http-body-parser.js";

async function bootstrap(): Promise<void> {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const host = process.env.HOST ?? "0.0.0.0";
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  configureHttpBodyParsers(app);

  await app.listen(port, host);
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start Vinyl API", error);
  process.exitCode = 1;
});
