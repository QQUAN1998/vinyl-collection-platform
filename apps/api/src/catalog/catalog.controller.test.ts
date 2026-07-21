import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";

describe("CatalogController", () => {
  let app: INestApplication;
  let catalog: {
    search: ReturnType<typeof vi.fn>;
    getAlbum: ReturnType<typeof vi.fn>;
    findTrackPreview: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    catalog = {
      search: vi.fn(async (input) => ({
        query: input.query,
        artist: input.artist,
        providers: { enabled: [], failed: [] },
        data: [],
      })),
      getAlbum: vi.fn(),
      findTrackPreview: vi.fn(async () => ({
        ok: false,
        provider: null,
        previewUrl: null,
        streamPath: null,
        durationMs: null,
        confidence: 0,
        matched: null,
        reason: "NO_PREVIEW",
      })),
    };

    const module = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: catalog }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("allows full search pages to request up to 300 catalog results", async () => {
    await request(app.getHttpServer())
      .get("/api/catalog/search")
      .query({ q: "周杰伦", artist: "周杰伦", limit: "400", country: "cn" })
      .expect(200);

    expect(catalog.search).toHaveBeenCalledWith(expect.objectContaining({
      query: "周杰伦",
      artist: "周杰伦",
      limit: 300,
      country: "CN",
    }));
  });

  it("normalizes track preview query input", async () => {
    catalog.findTrackPreview.mockResolvedValueOnce({
      ok: true,
      provider: "ITUNES",
      previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a",
      streamPath: "/api/catalog/preview/stream?track=%E7%BB%83%E4%B9%A0",
      durationMs: 30000,
      confidence: 96,
      matched: {
        track: "练习",
        artist: "刘德华",
        album: "练习",
      },
    });

    await request(app.getHttpServer())
      .get("/api/catalog/preview")
      .query({ track: " 练习 ", artist: " 刘德华 ", album: " 练习 ", country: "cn" })
      .expect(200);

    expect(catalog.findTrackPreview).toHaveBeenCalledWith({
      track: "练习",
      artist: "刘德华",
      album: "练习",
      country: "CN",
    });
  });
});
