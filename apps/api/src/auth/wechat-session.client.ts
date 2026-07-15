import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { request as httpsRequest } from "node:https";

export const WECHAT_SESSION_CLIENT = Symbol("WECHAT_SESSION_CLIENT");

export interface WechatSession {
  openId: string;
}

export interface WechatSessionClient {
  exchangeCode(code: string): Promise<WechatSession>;
}

type Code2SessionRequester = (url: URL) => Promise<Code2SessionResponse>;

@Injectable()
export class WechatApiSessionClient implements WechatSessionClient {
  private requestCode2Session: Code2SessionRequester = requestCode2SessionViaHttps;

  setCode2SessionRequesterForTest(requestCode2Session: Code2SessionRequester): void {
    this.requestCode2Session = requestCode2Session;
  }

  async exchangeCode(code: string): Promise<WechatSession> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new UnauthorizedException();
    }

    if (normalizedCode.startsWith("mock:") && process.env.NODE_ENV !== "production") {
      return getMockSession(normalizedCode);
    }

    const url = buildCode2SessionUrl(normalizedCode, getWechatAppCredentials());
    let payload: Code2SessionResponse;
    try {
      payload = await this.requestCode2Session(url);
    } catch (error) {
      console.error("WeChat code2session request failed", toSafeErrorLog(error));
      throw new ServiceUnavailableException();
    }
    if (payload.errcode && payload.errcode !== 0) {
      throw new UnauthorizedException();
    }
    if (typeof payload.openid !== "string" || !isValidOpenId(payload.openid)) {
      throw new UnauthorizedException();
    }

    return { openId: payload.openid.trim() };
  }
}

export function createWechatApiSessionClientForTest(
  requestCode2Session: Code2SessionRequester,
): WechatApiSessionClient {
  const client = new WechatApiSessionClient();
  client.setCode2SessionRequesterForTest(requestCode2Session);
  return client;
}

interface Code2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

function buildCode2SessionUrl(code: string, credentials: { appId: string; appSecret: string }): URL {
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", credentials.appId);
  url.searchParams.set("secret", credentials.appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");
  return url;
}

function requestCode2SessionViaHttps(url: URL): Promise<Code2SessionResponse> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        family: 4,
        timeout: 8_000,
        headers: {
          accept: "application/json",
          "user-agent": "vinyl-cabinet-cloudrun/1.0",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          const statusCode = response.statusCode ?? 0;
          const body = Buffer.concat(chunks).toString("utf8");
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`WeChat code2session returned HTTP ${statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(body) as Code2SessionResponse);
          } catch (error) {
            reject(new Error(`WeChat code2session returned invalid JSON: ${toSafeErrorLog(error).message}`));
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("WeChat code2session request timed out"));
    });
    request.on("error", reject);
    request.end();
  });
}

function toSafeErrorLog(error: unknown): { name: string; message: string; code?: string; cause?: string } {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string; cause?: unknown };
    const log: { name: string; message: string; code?: string; cause?: string } = {
      name: error.name,
      message: error.message,
    };
    if (withCode.code) {
      log.code = withCode.code;
    }
    if (withCode.cause instanceof Error) {
      log.cause = withCode.cause.message;
    }
    return log;
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
