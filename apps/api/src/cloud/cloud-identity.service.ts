import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { User } from "../generated/prisma/client.js";

import { AuthService } from "../auth/auth.service.js";
import { TokenService } from "../auth/token.service.js";

export type RequestHeaders = Readonly<Record<string, string | string[] | undefined>>;

const OPENID_HEADERS = [
  "x-wx-openid",
  "x-wx-from-openid",
  "x-wx-source-openid",
  "x-vinyl-dev-openid",
];

@Injectable()
export class CloudIdentityService {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
  ) {}

  async getCurrentUser(headers: RequestHeaders): Promise<User> {
    const openId = getWechatOpenId(headers);
    if (openId) {
      return this.authService.findOrCreateWechatUser({ wechatOpenId: openId });
    }

    const userId = getBearerUserId(headers, this.tokenService);
    if (userId) {
      return this.authService.getUserById(userId);
    }

    throw new UnauthorizedException();
  }
}

export function getWechatOpenId(headers: RequestHeaders): string | null {
  for (const name of OPENID_HEADERS) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    const openId = Array.isArray(value) ? value[0] : value;
    if (typeof openId === "string" && isValidOpenId(openId)) {
      return openId.trim();
    }
  }

  return null;
}

function isValidOpenId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value.trim());
}

function getBearerUserId(headers: RequestHeaders, tokenService: TokenService): string | null {
  const authorization = headers["authorization"] ?? headers["Authorization"];
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const prefix = "Bearer ";
  if (typeof value !== "string" || !value.startsWith(prefix)) {
    return null;
  }

  const token = value.slice(prefix.length).trim();
  if (!token) {
    return null;
  }

  try {
    return tokenService.verify(token).sub;
  } catch {
    throw new UnauthorizedException();
  }
}
