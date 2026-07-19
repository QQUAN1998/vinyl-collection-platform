import { describe, expect, it, vi } from "vitest";

import { TvDataService } from "./tv-data.service.js";

describe("TvDataService", () => {
  it("proxies APK login confirmation to the external TV session service", async () => {
    const service = new TvDataService();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "AB12CD",
        status: "confirmed",
        userId: "user-1",
        userName: "Alice",
        expiresAt: "2026-07-19T10:15:39.460Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        service.proxyConfirmExternalSession("AB12CD", {
          userId: "user-1",
          userName: "Alice",
          albums: [{ id: "album-1" }, { id: "album-2" }],
        }),
      ).resolves.toMatchObject({
        code: "AB12CD",
        status: "confirmed",
        userId: "user-1",
        syncedAlbumCount: 2,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54/cloud/vinyl-data/tv-login/session/AB12CD/confirm",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/json" },
        }),
      );
      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody).toMatchObject({
        userId: "user-1",
        userName: "Alice",
      });
      expect(requestBody.albums).toHaveLength(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
