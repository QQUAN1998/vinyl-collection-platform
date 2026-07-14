import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";

describe("CatalogController", () => {
  let app: INestApplication;
  let catalog: { search: ReturnType<typeof vi.fn>; getAlbum: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    catalog = {
      search: vi.fn(async (input) => ({
        query: input.query,
        artist: input.artist,
        providers: { enabled: [], failed: [] },
        data: [],
      })),
      getAlbum: vi.fn(),
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

  it("allows full search pages to request up to 50 catalog results", async () => {
    await request(app.getHttpServer())
      .get("/api/catalog/search")
      .query({ q: "周杰伦", artist: "周杰伦", limit: "80", country: "cn" })
      .expect(200);

    expect(catalog.search).toHaveBeenCalledWith(expect.objectContaining({
      query: "周杰伦",
      artist: "周杰伦",
      limit: 50,
      country: "CN",
    }));
  });
});
