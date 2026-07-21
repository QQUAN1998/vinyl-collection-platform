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
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      console.error("WeChat code2session request failed", toSafeErrorLog(error));
      throw new ServiceUnavailableException();
    }
    if (!response.ok) {
      console.error("WeChat code2session returned non-2xx status", {
        status: response.status,
      });
      throw new ServiceUnavailableException();
    }

    const payload = await parseCode2SessionResponse(response);
    if (payload.errcode && payload.errcode !== 0) {
      throw new UnauthorizedException();
    }
    if (typeof payload.openid !== "string" || !isValidOpenId(payload.openid)) {
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

async function parseCode2SessionResponse(response: Response): Promise<Code2SessionResponse> {
  try {
    return (await response.json()) as Code2SessionResponse;
  } catch (error) {
    console.error("WeChat code2session returned invalid JSON", toSafeErrorLog(error));
    throw new ServiceUnavailableException();
  }
}

function toSafeErrorLog(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: typeof error, message: String(error) };
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
