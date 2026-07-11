import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";

describe("API application", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves the health endpoint", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);

    expect(response.body).toEqual({ status: "ok" });
  });

  it("serves public collection policy information", async () => {
    const response = await request(app.getHttpServer()).get("/v1/system/info").expect(200);

    expect(response.body).toEqual({
      collectionLimits: { free: 10, vip: 10_000 },
      foundingMemberCount: 10,
    });
  });

  it("uses the shared error envelope for unknown routes", async () => {
    const response = await request(app.getHttpServer()).get("/missing").expect(404);

    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });
});
