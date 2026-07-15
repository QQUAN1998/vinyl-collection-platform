import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "./app.module.js";
import { PrismaService } from "./database/prisma.service.js";
import { MembershipPlan } from "./generated/prisma/enums.js";

interface FakeUser {
  id: string;
  wechatOpenId: string;
  displayName: string;
  avatarUrl: string | null;
  phoneNumber: string | null;
  phoneCountryCode: string | null;
  phoneAuthorizedAt: Date | null;
  registrationSequence: number;
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
  private readonly users: FakeUser[] = [];
  private readonly memberships: FakeMembership[] = [];

  readonly user = {
    findUnique: async ({ where }: { where: { id?: string; wechatOpenId?: string } }) => {
      return (
        this.users.find((user) => user.id === where.id || user.wechatOpenId === where.wechatOpenId) ??
        null
      );
    },
    create: async ({ data }: { data: { wechatOpenId: string; displayName: string; avatarUrl?: string | null } }) => {
      this.userSequence += 1;
      const now = new Date("2026-07-11T12:00:00.000Z");
      const user: FakeUser = {
        id: `user-${this.userSequence}`,
        wechatOpenId: data.wechatOpenId,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl ?? null,
        phoneNumber: null,
        phoneCountryCode: null,
        phoneAuthorizedAt: null,
        registrationSequence: this.userSequence,
        createdAt: now,
        updatedAt: now,
      };
      this.users.push(user);
      return user;
    },
    update: async ({
      data,
      where,
    }: {
      data: {
        displayName?: string;
        avatarUrl?: string | null;
        phoneNumber?: string | null;
        phoneCountryCode?: string | null;
        phoneAuthorizedAt?: Date | null;
      };
      where: { id: string };
    }) => {
      const user = this.users.find((candidate) => candidate.id === where.id);
      if (!user) {
        throw new Error("User not found");
      }
      user.displayName = data.displayName ?? user.displayName;
      user.avatarUrl = data.avatarUrl ?? user.avatarUrl;
      user.phoneNumber = data.phoneNumber ?? user.phoneNumber;
      user.phoneCountryCode = data.phoneCountryCode ?? user.phoneCountryCode;
      user.phoneAuthorizedAt = data.phoneAuthorizedAt ?? user.phoneAuthorizedAt;
      user.updatedAt = new Date("2026-07-11T12:00:00.000Z");
      return user;
    },
  };

  readonly membership = {
    create: async ({ data }: { data: { userId: string; plan: typeof MembershipPlan[keyof typeof MembershipPlan]; startsAt: Date; expiresAt: Date } }) => {
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
    findFirst: async ({ where }: { where: { userId: string; revokedAt?: null } }) => {
      return (
        this.memberships
          .filter((membership) => membership.userId === where.userId && membership.revokedAt === null)
          .sort((left, right) => right.expiresAt.getTime() - left.expiresAt.getTime())[0] ?? null
      );
    },
  };

  readonly collection = {
    count: async ({ where }: { where: { userId: string } }) => (where.userId ? 0 : 0),
  };

  async $transaction<T>(callback: (client: this) => Promise<T>): Promise<T> {
    return callback(this);
  }
}

describe("Wechat auth API", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env["DATABASE_URL"] = "mysql://vinyl:vinyl@127.0.0.1:3306/vinyl";
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

  it("exchanges a mock WeChat code for a token and returns the current profile", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/v1/auth/wechat-login")
      .send({ code: "mock:alice", displayName: "Alice" })
      .expect(201);

    expect(loginResponse.body.token).toEqual(expect.any(String));
    expect(loginResponse.body.me).toMatchObject({
      user: {
        id: "user-1",
        displayName: "Alice",
        avatarUrl: null,
        hasPhoneNumber: false,
        phoneNumberMasked: null,
        phoneCountryCode: null,
        phoneAuthorizedAt: null,
        membership: {
          status: "VIP_ACTIVE",
          isVip: true,
          collectionLimit: 10_000,
        },
      },
      stats: { collectionCount: 0 },
    });
    expect(loginResponse.body.me.user.membership.expiresAt).toBe("2027-07-11T12:00:00.000Z");

    const meResponse = await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${loginResponse.body.token}`)
      .expect(200);

    expect(meResponse.body).toEqual(loginResponse.body.me);
  });

  it("does not grant founding VIP after the first ten registrations", async () => {
    for (let index = 1; index <= 10; index += 1) {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/wechat-login")
        .send({ code: `mock:user-${index}` })
        .expect(201);

      expect(response.body.me.user.membership.status).toBe("VIP_ACTIVE");
    }

    const response = await request(app.getHttpServer())
      .post("/v1/auth/wechat-login")
      .send({ code: "mock:user-11" })
      .expect(201);

    expect(response.body.me.user.membership).toEqual({
      status: "FREE",
      isVip: false,
      expiresAt: null,
      collectionLimit: 10,
    });
  });

  it("rejects invalid WeChat login codes", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/auth/wechat-login")
      .send({ code: "mock:bad openid!" })
      .expect(401);

    expect(response.body).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  });

  it("requires a bearer token for the current profile endpoint", async () => {
    const response = await request(app.getHttpServer()).get("/v1/me").expect(401);

    expect(response.body).toEqual({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  });
});
