import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const app = await NestFactory.create(AppModule);

  await app.listen(port, "127.0.0.1");
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start Vinyl API", error);
  process.exitCode = 1;
});
