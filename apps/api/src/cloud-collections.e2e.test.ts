import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";
import { PrismaService } from "./database/prisma.service.js";
import { AlbumSource, MembershipPlan } from "./generated/prisma/enums.js";

interface FakeUser {
  id: string;
  wechatOpenId: string;
  displayName: string;
  avatarUrl: string | null;
  registrationSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeAlbum {
  id: string;
  title: string;
  artist: string;
  releaseYear: number | null;
  genre: string | null;
  coverUrl: string | null;
  source: typeof AlbumSource[keyof typeof AlbumSource];
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  tracks: Array<{ position: number; title: string }>;
}

interface FakeCollection {
  id: string;
  userId: string;
  albumId: string;
  purchasePriceCents: number | null;
  collectedAt: Date;
  source: string | null;
  quantity: number;
  condition: string | null;
  mediumKey: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeMembership {
  id: string;
  userId: string;
  plan: typeof MembershipPlan[keyof typeof MembershipPlan];
  startsAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

class FakePrismaService {
  private userSequence = 0;
  private collectionSequence = 0;
  private readonly users: FakeUser[] = [];
  private readonly albums: FakeAlbum[] = [];
  private readonly collections: FakeCollection[] = [];
  private readonly memberships: FakeMembership[] = [];
  private readonly now = new Date("2026-07-12T12:00:00.000Z");

  readonly user = {
    findUnique: async ({ where }: { where: { id?: string; wechatOpenId?: string } }) =>
      this.users.find((user) => user.id === where.id || user.wechatOpenId === where.wechatOpenId) ?? null,
    create: async ({
      data,
    }: {
      data: { wechatOpenId: string; displayName: string; avatarUrl?: string | null };
    }) => {
      this.userSequence += 1;
      const user: FakeUser = {
        id: `user-${this.userSequence}`,
        wechatOpenId: data.wechatOpenId,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl ?? null,
        registrationSequence: this.userSequence,
        createdAt: this.now,
        updatedAt: this.now,
      };
      this.users.push(user);
      return user;
    },
  };

  readonly membership = {
    create: async ({
      data,
    }: {
      data: {
        userId: string;
        plan: typeof MembershipPlan[keyof typeof MembershipPlan];
        startsAt: Date;
        expiresAt: Date;
      };
    }) => {
      const membership: FakeMembership = {
        id: `membership-${this.memberships.length + 1}`,
        userId: data.userId,
        plan: data.plan,
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
        revokedAt: null,
        createdAt: data.startsAt,
      };
      this.memberships.push(membership);
      return membership;
    },
    findFirst: async ({ where }: { where: { userId: string; revokedAt?: null } }) =>
      this.memberships
        .filter((membership) => membership.userId === where.userId && membership.revokedAt === null)
        .sort((left, right) => right.expiresAt.getTime() - left.expiresAt.getTime())[0] ?? null,
  };

  readonly album = {
    findMany: async () => this.albums.map((album) => ({ ...album, tracks: album.tracks })),
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { id: string };
      create: Omit<FakeAlbum, "createdAt" | "updatedAt" | "tracks"> & {
        tracks?: { create?: Array<{ position: number; title: string }> };
      };
      update: Partial<Omit<FakeAlbum, "id" | "createdAt" | "tracks">>;
    }) => {
      const existing = this.albums.find((album) => album.id === where.id);
      if (existing) {
        Object.assign(existing, update, { updatedAt: this.now });
        return { ...existing, tracks: existing.tracks };
      }

      const album: FakeAlbum = {
        id: create.id,
        title: create.title,
        artist: create.artist,
        releaseYear: create.releaseYear,
        genre: create.genre,
        coverUrl: create.coverUrl,
        source: create.source,
        createdById: create.createdById,
        createdAt: this.now,
        updatedAt: this.now,
        tracks: create.tracks?.create ?? [],
      };
      this.albums.push(album);
      return { ...album, tracks: album.tracks };
    },
  };

  readonly collection = {
    count: async ({ where }: { where: { userId: string } }) =>
      this.collections.filter((collection) => collection.userId === where.userId).length,
    findMany: async ({ where }: { where: { userId: string } }) =>
      this.collections
        .filter((collection) => collection.userId === where.userId)
        .map((collection) => this.withAlbum(collection)),
    findUnique: async ({ where }: { where: { id: string } }) => {
      const collection = this.collections.find((item) => item.id === where.id);
      return collection ? this.withAlbum(collection) : null;
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { userId_albumId: { userId: string; albumId: string } };
      create: Omit<FakeCollection, "id" | "createdAt" | "updatedAt">;
      update: Partial<Omit<FakeCollection, "id" | "createdAt" | "updatedAt">>;
    }) => {
      const existing = this.collections.find(
        (collection) =>
          collection.userId === where.userId_albumId.userId &&
          collection.albumId === where.userId_albumId.albumId,
      );
      if (existing) {
        Object.assign(existing, update, { updatedAt: this.now });
        return this.withAlbum(existing);
      }

      this.collectionSequence += 1;
      const collection: FakeCollection = {
        ...create,
        id: `collection-${this.collectionSequence}`,
        createdAt: this.now,
        updatedAt: this.now,
      };
      this.collections.push(collection);
      return this.withAlbum(collection);
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Omit<FakeCollection, "id" | "createdAt" | "updatedAt">>;
    }) => {
      const collection = this.collections.find((item) => item.id === where.id);
      if (!collection) {
        throw new Error("Collection not found");
      }
      Object.assign(collection, data, { updatedAt: this.now });
      return this.withAlbum(collection);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const index = this.collections.findIndex((item) => item.id === where.id);
      if (index < 0) {
        throw new Error("Collection not found");
      }
      const [collection] = this.collections.splice(index, 1);
      return this.withAlbum(collection);
    },
  };

  async $transaction<T>(callback: (client: this) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private withAlbum(collection: FakeCollection): FakeCollection & { album: FakeAlbum } {
    const album = this.albums.find((candidate) => candidate.id === collection.albumId);
    if (!album) {
      throw new Error("Album not found");
    }
    return { ...collection, album };
  }
}

describe("WeChat cloud collection API", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env["DATABASE_URL"] = "mysql://root:secret@127.0.0.1:3306/vinyl_cabinet";
    process.env["AUTH_TOKEN_SECRET"] = "test-secret-at-least-32-characters-long";
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(new FakePrismaService())
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    delete process.env["AUTH_TOKEN_SECRET"];
  });

  it("persists the caller collection and exposes it through a share owner id", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/collections")
      .set("x-wx-openid", "openid-alice")
      .send({
        album: {
          id: "memories",
          title: "The Best of David Tao",
          artist: "陶喆",
          year: 2003,
          style: "华语 R&B",
          coverUrl: "assets/covers/memories.webp",
        },
        collection: {
          collectionDate: "2025-05-01",
          source: "线上购买",
          quantity: 1,
          condition: "NM",
          mediumKey: "vinyl",
          price: 9700,
          notes: "Signed copy",
        },
      })
      .expect(201);

    expect(created.body.owner).toMatchObject({
      id: "user-1",
      displayName: "唱片柜用户",
    });
    expect(created.body.collectionItems).toHaveLength(1);
    expect(created.body.collectionItems[0]).toMatchObject({
      albumId: "memories",
      condition: "NM",
      price: 9700,
      notes: "Signed copy",
    });

    const mine = await request(app.getHttpServer())
      .get("/api/collections/me")
      .set("x-wx-openid", "openid-alice")
      .expect(200);

    expect(mine.body.collectionItems[0].albumId).toBe("memories");

    const shared = await request(app.getHttpServer())
      .get(`/api/collections/shared/${mine.body.owner.id}`)
      .set("x-wx-openid", "openid-bob")
      .expect(200);

    expect(shared.body.owner.id).toBe("user-1");
    expect(shared.body.collectionItems.map((item: { albumId: string }) => item.albumId)).toEqual([
      "memories",
    ]);
  });

  it("requires a WeChat cloud openid header", async () => {
    const response = await request(app.getHttpServer()).get("/api/collections/me").expect(401);

    expect(response.body).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  });
});
