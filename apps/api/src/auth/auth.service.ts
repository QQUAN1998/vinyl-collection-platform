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
  WECHAT_PHONE_NUMBER_CLIENT,
  type WechatPhoneNumberClient,
} from "./wechat-phone.client.js";
import {
  WECHAT_SESSION_CLIENT,
  type WechatSessionClient,
} from "./wechat-session.client.js";

export interface WechatLoginInput {
  code: string;
  displayName?: string;
  avatarUrl?: string | null;
}

const DEFAULT_DISPLAY_NAME = "唱片柜用户";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Inject(WECHAT_SESSION_CLIENT)
    private readonly wechatSessionClient: WechatSessionClient,
    @Inject(WECHAT_PHONE_NUMBER_CLIENT)
    private readonly wechatPhoneNumberClient: WechatPhoneNumberClient,
  ) {}

  async loginWithWechat(input: WechatLoginInput): Promise<AuthLoginResponse> {
    const session = await this.wechatSessionClient.exchangeCode(input.code);
    const user = await this.findOrCreateWechatUser(
      compactWechatUserInput({
        wechatOpenId: session.openId,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
      }),
    );
    const token = this.tokenService.sign({ sub: user.id });
    const me = await this.getMe(user.id);

    return { token, me };
  }

  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.getUserById(userId);

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

  async loginWithCloudIdentity(input: {
    wechatOpenId: string;
    displayName?: string;
    avatarUrl?: string | null;
  }): Promise<MeResponse> {
    const user = await this.findOrCreateWechatUser(compactWechatUserInput(input));
    return this.getMe(user.id);
  }

  async getUserById(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  async authorizePhoneNumber(userId: string, code: string): Promise<MeResponse> {
    const phone = await this.wechatPhoneNumberClient.getPhoneNumber(code);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phoneNumber: phone.phoneNumber,
        phoneCountryCode: phone.countryCode,
        phoneAuthorizedAt: new Date(),
      },
    });

    return this.getMe(userId);
  }

  async findOrCreateWechatUser(input: {
    wechatOpenId: string;
    displayName?: string;
    avatarUrl?: string | null;
  }): Promise<User> {
    return this.prisma.$transaction(async (transaction) => {
      const existingUser = await transaction.user.findUnique({
        where: { wechatOpenId: input.wechatOpenId },
      });
      if (existingUser) {
        const profilePatch = buildProfilePatch(existingUser, input);
        return profilePatch
          ? transaction.user.update({ where: { id: existingUser.id }, data: profilePatch })
          : existingUser;
      }

      const displayName = normalizeDisplayName(input.displayName) ?? DEFAULT_DISPLAY_NAME;
      const avatarUrl = normalizeAvatarUrl(input.avatarUrl) ?? null;
      const user = await transaction.user.create({
        data: {
          wechatOpenId: input.wechatOpenId,
          displayName,
          avatarUrl,
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
    hasPhoneNumber: Boolean(user.phoneNumber),
    phoneNumberMasked: maskPhoneNumber(user.phoneNumber),
    phoneCountryCode: user.phoneCountryCode,
    phoneAuthorizedAt: user.phoneAuthorizedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    membership: {
      status: access.isVip ? "VIP_ACTIVE" : hasAnyMembership ? "VIP_EXPIRED" : "FREE",
      isVip: access.isVip,
      expiresAt: expiresAt?.toISOString() ?? null,
      collectionLimit: access.isVip ? VIP_COLLECTION_LIMIT : FREE_COLLECTION_LIMIT,
    },
  };
}

function buildProfilePatch(
  user: User,
  input: { displayName?: string; avatarUrl?: string | null },
): { displayName?: string; avatarUrl?: string | null } | null {
  const displayName = normalizeDisplayName(input.displayName);
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl);
  const patch: { displayName?: string; avatarUrl?: string | null } = {};

  if (displayName && displayName !== user.displayName) {
    patch.displayName = displayName;
  }
  if (avatarUrl !== undefined && avatarUrl !== user.avatarUrl) {
    patch.avatarUrl = avatarUrl;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function normalizeDisplayName(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const displayName = value.trim().slice(0, 64);
  return displayName || undefined;
}

function normalizeAvatarUrl(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }

  const avatarUrl = value.trim().slice(0, 2048);
  return avatarUrl || null;
}

function maskPhoneNumber(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length <= 7) {
    return `${normalized.slice(0, 2)}****`;
  }

  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}

function compactWechatUserInput(input: {
  wechatOpenId: string;
  displayName?: string | undefined;
  avatarUrl?: string | null | undefined;
}): { wechatOpenId: string; displayName?: string; avatarUrl?: string | null } {
  const compacted: { wechatOpenId: string; displayName?: string; avatarUrl?: string | null } = {
    wechatOpenId: input.wechatOpenId,
  };
  if (input.displayName !== undefined) {
    compacted.displayName = input.displayName;
  }
  if (input.avatarUrl !== undefined) {
    compacted.avatarUrl = input.avatarUrl;
  }
  return compacted;
}
