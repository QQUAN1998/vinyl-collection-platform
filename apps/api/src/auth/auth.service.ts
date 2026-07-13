import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import {
  FREE_COLLECTION_LIMIT,
  getCollectionAccess,
  getFoundingMemberExpiry,
  type AuthLoginResponse,
  type MeResponse,
  VIP_COLLECTION_LIMIT,
} from "@vinyl/shared";

import { PrismaService } from "../database/prisma.service.js";
import { MembershipPlan } from "../generated/prisma/enums.js";
import type { Membership, User } from "../generated/prisma/client.js";
import { TokenService } from "./token.service.js";
import {
  WECHAT_SESSION_CLIENT,
  type WechatSessionClient,
} from "./wechat-session.client.js";

export interface WechatLoginInput {
  code: string;
  displayName?: string;
  avatarUrl?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(WECHAT_SESSION_CLIENT)
    private readonly wechatSessionClient: WechatSessionClient,
  ) {}

  async loginWithWechat(input: WechatLoginInput): Promise<AuthLoginResponse> {
    const session = await this.wechatSessionClient.exchangeCode(input.code);
    const user = await this.findOrCreateWechatUser({
      wechatOpenId: session.openId,
      displayName: input.displayName ?? "唱片柜用户",
      avatarUrl: input.avatarUrl ?? null,
    });
    const token = this.tokenService.sign({ sub: user.id });
    const me = await this.getMe(user.id);

    return { token, me };
  }

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    const [membership, collectionCount] = await Promise.all([
      this.prisma.membership.findFirst({
        where: { userId: user.id, revokedAt: null },
        orderBy: { expiresAt: "desc" },
      }),
      this.prisma.collection.count({ where: { userId: user.id } }),
    ]);

    return {
      user: toUserProfile(user, membership, new Date()),
      stats: { collectionCount },
    };
  }

  async findOrCreateWechatUser(input: {
    wechatOpenId: string;
    displayName: string;
    avatarUrl: string | null;
  }): Promise<User> {
    return this.prisma.$transaction(async (transaction) => {
      const existingUser = await transaction.user.findUnique({
        where: { wechatOpenId: input.wechatOpenId },
      });
      if (existingUser) {
        return existingUser;
      }

      const user = await transaction.user.create({
        data: {
          wechatOpenId: input.wechatOpenId,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
        },
      });
      const foundingExpiry = getFoundingMemberExpiry({
        registrationSequence: user.registrationSequence,
        registeredAt: user.createdAt,
      });
      if (foundingExpiry) {
        await transaction.membership.create({
          data: {
            userId: user.id,
            plan: MembershipPlan.FOUNDING,
            startsAt: user.createdAt,
            expiresAt: foundingExpiry,
          },
        });
      }

      return user;
    });
  }
}

function toUserProfile(user: User, membership: Membership | null, now: Date): MeResponse["user"] {
  const expiresAt = membership?.expiresAt ?? null;
  const access = getCollectionAccess({ membershipExpiresAt: expiresAt, now });
  const hasAnyMembership = expiresAt !== null;

  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    membership: {
      status: access.isVip ? "VIP_ACTIVE" : hasAnyMembership ? "VIP_EXPIRED" : "FREE",
      isVip: access.isVip,
      expiresAt: expiresAt?.toISOString() ?? null,
      collectionLimit: access.isVip ? VIP_COLLECTION_LIMIT : FREE_COLLECTION_LIMIT,
    },
  };
}
