import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
  UnprocessableEntityException,
  Inject,
} from "@nestjs/common";
import type { AuthLoginResponse, MeResponse } from "@vinyl/shared";

import { AuthService } from "./auth.service.js";
import { TokenService } from "./token.service.js";

interface WechatLoginBody {
  code: string;
  displayName?: string;
  avatarUrl?: string | null;
}

@Controller("v1")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
  ) {}

  @Post("auth/wechat-login")
  async loginWithWechat(@Body() body: unknown): Promise<AuthLoginResponse> {
    const input = parseWechatLoginBody(body);
    return this.authService.loginWithWechat(input);
  }

  @Get("me")
  async getMe(@Headers("authorization") authorization: string | undefined): Promise<MeResponse> {
    const token = parseBearerToken(authorization);
    const payload = this.tokenService.verify(token);
    return this.authService.getMe(payload.sub);
  }
}

function parseWechatLoginBody(value: unknown): WechatLoginBody {
  if (typeof value !== "object" || value === null) {
    throw new UnprocessableEntityException();
  }

  const body = value as Record<string, unknown>;
  if (typeof body["code"] !== "string" || body["code"].trim().length === 0) {
    throw new UnprocessableEntityException();
  }

  const input: WechatLoginBody = { code: body["code"].trim() };
  if (body["displayName"] !== undefined) {
    if (typeof body["displayName"] !== "string" || body["displayName"].trim().length === 0) {
      throw new UnprocessableEntityException();
    }
    input.displayName = body["displayName"].trim().slice(0, 64);
  }
  if (body["avatarUrl"] !== undefined && body["avatarUrl"] !== null) {
    if (typeof body["avatarUrl"] !== "string") {
      throw new UnprocessableEntityException();
    }
    input.avatarUrl = body["avatarUrl"];
  }

  return input;
}

function parseBearerToken(authorization: string | undefined): string {
  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) {
    throw new UnauthorizedException();
  }

  const token = authorization.slice(prefix.length).trim();
  if (!token) {
    throw new UnauthorizedException();
  }

  return token;
}
