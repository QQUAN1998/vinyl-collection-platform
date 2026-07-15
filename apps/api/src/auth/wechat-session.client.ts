import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

export const WECHAT_SESSION_CLIENT = Symbol("WECHAT_SESSION_CLIENT");

export interface WechatSession {
  openId: string;
}

export interface WechatSessionClient {
  exchangeCode(code: string): Promise<WechatSession>;
}

@Injectable()
export class WechatApiSessionClient implements WechatSessionClient {
  async exchangeCode(code: string): Promise<WechatSession> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new UnauthorizedException();
    }

    if (normalizedCode.startsWith("mock:") && process.env.NODE_ENV !== "production") {
      return getMockSession(normalizedCode);
    }

    const { appId, appSecret } = getWechatAppCredentials();
    const url =
      "https://api.weixin.qq.com/sns/jscode2session" +
      `?appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(appSecret)}` +
      `&js_code=${encodeURIComponent(normalizedCode)}` +
      "&grant_type=authorization_code";
    const response = await fetch(url);
    if (!response.ok) {
      throw new ServiceUnavailableException();
    }

    const payload = (await response.json()) as Code2SessionResponse;
    if (payload.errcode && payload.errcode !== 0) {
      throw new UnauthorizedException();
    }
    if (!payload.openid || !isValidOpenId(payload.openid)) {
      throw new UnauthorizedException();
    }

    return { openId: payload.openid.trim() };
  }
}

interface Code2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

function getMockSession(code: string): WechatSession {
  const mockId = code.slice("mock:".length).trim();
  if (!isValidOpenId(mockId)) {
    throw new UnauthorizedException();
  }

  return { openId: `mock-openid-${mockId}` };
}

function getWechatAppCredentials(): { appId: string; appSecret: string } {
  const appId =
    process.env["WECHAT_APP_ID"] ?? process.env["WECHAT_APPID"] ?? process.env["WX_APP_ID"];
  const appSecret =
    process.env["WECHAT_APP_SECRET"] ??
    process.env["WECHAT_APPSECRET"] ??
    process.env["WX_APP_SECRET"];

  if (!appId || !appSecret) {
    throw new ServiceUnavailableException();
  }

  return { appId, appSecret };
}

function isValidOpenId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value.trim());
}
