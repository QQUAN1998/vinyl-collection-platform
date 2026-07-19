import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module.js";
import { configureHttpBodyParsers } from "../http-body-parser.js";

function buildLargeTvPayload() {
  const albums = Array.from({ length: 385 }, (_, albumIndex) => ({
    id: `album-${albumIndex + 1}`,
    title: `Album ${albumIndex + 1}`,
    artist: `Artist ${albumIndex + 1}`,
    year: 2026,
    cover: "https://example.com/cover.jpg",
    price: 300 + albumIndex,
    quantity: (albumIndex % 4) + 1,
    format: "黑胶",
    songs: Array.from({ length: 13 }, (_, songIndex) => ({
      title: `Song ${songIndex + 1}`,
      duration: "03:30",
    })),
  }));

  return {
    userId: "large-user",
    userName: "Large User",
    albums,
  };
}

describe("TV data proxy API", () => {
  let app: NestExpressApplication | undefined;

  beforeEach(async () => {
    process.env["DATABASE_URL"] = "mysql://vinyl:vinyl@127.0.0.1:3306/vinyl";
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureHttpBodyParsers(app);
    await app.init();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await app?.close();
    app = undefined;
    delete process.env["DATABASE_URL"];
  });

  it("accepts a realistic TV login payload larger than Express' default 100kb body limit", async () => {
    const payload = buildLargeTvPayload();
    const payloadText = JSON.stringify(payload);
    expect(Buffer.byteLength(payloadText)).toBeGreaterThan(100 * 1024);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "BIG123",
        status: "confirmed",
        userId: "large-user",
        userName: "Large User",
        expiresAt: "2026-07-19T12:00:00.000Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app?.getHttpServer())
      .post("/cloud/vinyl-data/tv-login/session/BIG123/proxy-confirm")
      .send(payload)
      .expect(201);

    expect(response.body).toMatchObject({
      code: "BIG123",
      status: "confirmed",
      syncedAlbumCount: 385,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
