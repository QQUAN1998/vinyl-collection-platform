import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { User } from "../generated/prisma/client.js";

import { AuthService } from "../auth/auth.service.js";

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
  ) {}

  async getCurrentUser(headers: RequestHeaders): Promise<User> {
    const openId = getWechatOpenId(headers);
    if (!openId) {
      throw new UnauthorizedException();
    }

    return this.authService.findOrCreateWechatUser({ wechatOpenId: openId });
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
