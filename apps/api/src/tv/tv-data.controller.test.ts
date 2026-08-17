import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudIdentityService } from "../cloud/cloud-identity.service.js";
import { TvDataController } from "./tv-data.controller.js";
import { TvDataService } from "./tv-data.service.js";

describe("TvDataController", () => {
  let app: INestApplication;
  let tvData: {
    resolveTvCoverUrl: ReturnType<typeof vi.fn>;
    proxyConfirmExternalSession: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    tvData = {
      resolveTvCoverUrl: vi.fn(async () => "https://cdn.example.com/custom.jpg"),
      proxyConfirmExternalSession: vi.fn(async () => ({ status: "confirmed" })),
    };
    const identity = {
      getCurrentUser: vi.fn(async () => null),
    };
    const module = await Test.createTestingModule({
      controllers: [TvDataController],
      providers: [
        { provide: TvDataService, useValue: tvData },
        { provide: CloudIdentityService, useValue: identity },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("redirects the stable cover URL to a fresh cloud download URL", async () => {
    const fileId = "cloud://prod.bucket/album-covers/user-1/custom.jpg";

    await request(app.getHttpServer())
      .get("/cloud/vinyl-data/tv-cover")
      .query({ fileId })
      .expect(302)
      .expect("location", "https://cdn.example.com/custom.jpg");

    expect(tvData.resolveTvCoverUrl).toHaveBeenCalledWith(fileId);
  });

  it("passes TV confirmation data to the service", async () => {
    const body = { userId: "user-1", albums: [] };

    await request(app.getHttpServer())
      .post("/cloud/vinyl-data/tv-login/session/AB12CD/proxy-confirm")
      .send(body)
      .expect(201);

    expect(tvData.proxyConfirmExternalSession).toHaveBeenCalledWith(
      "AB12CD",
      body,
      undefined,
    );
  });
});
