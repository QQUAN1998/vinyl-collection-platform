import { describe, expect, it, vi } from "vitest";

import { TvDataService } from "./tv-data.service.js";

describe("TvDataService", () => {
  it("creates, confirms, polls, and serves a TV login library", async () => {
    const prisma = new FakePrismaService();
    const service = new TvDataService(prisma as never);

    const session = await service.createLoginSession("https://example.com");

    expect(session.code).toMatch(/^[A-F0-9]{8}$/);
    expect(session.scanUrl).toBe(`https://example.com/cloud/vinyl-data/tv-login/${session.code}/scan`);
    await expect(service.getLoginSession(session.code)).resolves.toMatchObject({
      code: session.code,
      status: "pending",
      userId: "",
    });

    await expect(
      service.confirmLoginSession(session.code, {
        userId: "user-1",
        userName: "Alice",
        albums: [{ id: "album-1" }],
      }),
    ).resolves.toMatchObject({
      code: session.code,
      status: "confirmed",
      userId: "user-1",
      userName: "Alice",
    });

    await expect(service.getLoginSession(session.code)).resolves.toMatchObject({
      status: "confirmed",
      userId: "user-1",
      userName: "Alice",
    });

    const library = await service.getLibraryForUser("user-1");
    expect(library.albums).toHaveLength(1);
    expect(library.albums[0]).toMatchObject({
      id: "album-1",
      title: "Memories",
      artist: "刘德华",
      cover: "https://example.com/memories.jpg",
      songCount: 2,
    });
    expect(library.summary).toMatchObject({
      albumCount: 1,
      artistCount: 1,
      quantity: 1,
      totalPrice: 128,
    });
  });

  it("proxies APK login confirmation to the external TV session service", async () => {
    const prisma = new FakePrismaService();
    const service = new TvDataService(prisma as never);
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

class FakePrismaService {
  private readonly auditLogs: FakeAuditLog[] = [];
  private readonly tvDevices: unknown[] = [];
  private readonly users = [
    {
      id: "user-1",
      wechatOpenId: "openid-1",
      displayName: "Alice",
      avatarUrl: null,
      phoneNumber: null,
      phoneCountryCode: null,
      phoneAuthorizedAt: null,
      registrationSequence: 1,
      createdAt: new Date("2026-07-15T00:00:00.000Z"),
      updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    },
  ];

  readonly auditLog = {
    create: async ({ data }: { data: Omit<FakeAuditLog, "id" | "createdAt"> }) => {
      const record = {
        id: `audit-${this.auditLogs.length + 1}`,
        createdAt: new Date("2026-07-15T00:00:00.000Z"),
        ...data,
      };
      this.auditLogs.push(record);
      return record;
    },
    findFirst: async ({ where }: { where: { action: string; actorId: string } }) =>
      this.auditLogs.find((record) => record.action === where.action && record.actorId === where.actorId) || null,
    update: async ({ where, data }: { where: { id: string }; data: Partial<FakeAuditLog> }) => {
      const record = this.auditLogs.find((item) => item.id === where.id);
      if (!record) throw new Error("audit not found");
      Object.assign(record, data);
      return record;
    },
  };

  readonly tvDevice = {
    upsert: async ({ create, update }: { create: unknown; update: unknown }) => {
      const value = { ...create, ...update };
      this.tvDevices.push(value);
      return value;
    },
  };

  readonly user = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.users.find((user) => user.id === where.id) || null,
  };

  readonly collection = {
    findMany: async ({ where }: { where: { userId: string } }) => {
      if (where.userId !== "user-1") return [];
      return [
        {
          id: "collection-1",
          userId: "user-1",
          albumId: "album-1",
          purchasePriceCents: 12800,
          collectedAt: new Date("2026-07-15T00:00:00.000Z"),
          source: "Discogs",
          quantity: 1,
          condition: "NM",
          mediumKey: "vinyl",
          note: "",
          createdAt: new Date("2026-07-15T00:00:00.000Z"),
          updatedAt: new Date("2026-07-15T00:00:00.000Z"),
          album: {
            id: "album-1",
            title: "Memories",
            artist: "刘德华",
            releaseYear: 2002,
            genre: "粤语流行",
            coverUrl: "https://example.com/memories.jpg",
            rarity: "N",
            source: "CATALOG",
            createdById: "user-1",
            createdAt: new Date("2026-07-15T00:00:00.000Z"),
            updatedAt: new Date("2026-07-15T00:00:00.000Z"),
            tracks: [
              { id: "track-1", albumId: "album-1", position: 1, title: "第一首" },
              { id: "track-2", albumId: "album-1", position: 2, title: "第二首" },
            ],
          },
        },
      ];
    },
  };
}

interface FakeAuditLog {
  id: string;
  userId?: string | null;
  actorType: string;
  actorId: string;
  action: string;
  reason?: string | null;
  metadata: unknown;
  createdAt: Date;
}
