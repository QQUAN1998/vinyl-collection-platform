import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

export const WECHAT_PHONE_NUMBER_CLIENT = Symbol("WECHAT_PHONE_NUMBER_CLIENT");

export interface WechatPhoneNumber {
  phoneNumber: string;
  countryCode: string | null;
}

export interface WechatPhoneNumberClient {
  getPhoneNumber(code: string): Promise<WechatPhoneNumber>;
}

interface AccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface PhoneNumberResponse {
  errcode?: number;
  errmsg?: string;
  phone_info?: {
    phoneNumber?: string;
    purePhoneNumber?: string;
    countryCode?: string;
  };
}

@Injectable()
export class WechatApiPhoneNumberClient implements WechatPhoneNumberClient {
  private cachedAccessToken: { value: string; expiresAtMs: number } | null = null;

  async getPhoneNumber(code: string): Promise<WechatPhoneNumber> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      throw new UnauthorizedException();
    }

    if (normalizedCode.startsWith("mock-phone:") && process.env.NODE_ENV !== "production") {
      return getMockPhoneNumber(normalizedCode);
    }

    const accessToken = await this.getAccessToken();
    const response = await fetch(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException();
    }

    const payload = (await response.json()) as PhoneNumberResponse;
    if (payload.errcode && payload.errcode !== 0) {
      throw new UnauthorizedException();
    }

    const phoneInfo = payload.phone_info;
    const phoneNumber = normalizePhoneNumber(
      phoneInfo?.purePhoneNumber ?? phoneInfo?.phoneNumber ?? "",
    );
    if (!phoneNumber) {
      throw new UnauthorizedException();
    }

    return {
      phoneNumber,
      countryCode: normalizeCountryCode(phoneInfo?.countryCode ?? null),
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedAccessToken && this.cachedAccessToken.expiresAtMs > now + 60_000) {
      return this.cachedAccessToken.value;
    }

    const { appId, appSecret } = getWechatAppCredentials();
    const url =
      "https://api.weixin.qq.com/cgi-bin/token" +
      `?grant_type=client_credential&appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(appSecret)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new ServiceUnavailableException();
    }

    const payload = (await response.json()) as AccessTokenResponse;
    if (payload.errcode && payload.errcode !== 0) {
      throw new ServiceUnavailableException();
    }
    if (!payload.access_token) {
      throw new ServiceUnavailableException();
    }

    const ttlMs = Math.max(Number(payload.expires_in ?? 7200) - 300, 60) * 1000;
    this.cachedAccessToken = {
      value: payload.access_token,
      expiresAtMs: now + ttlMs,
    };
    return payload.access_token;
  }
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

function getMockPhoneNumber(code: string): WechatPhoneNumber {
  const phoneNumber = normalizePhoneNumber(code.slice("mock-phone:".length));
  if (!phoneNumber) {
    throw new UnauthorizedException();
  }

  return { phoneNumber, countryCode: "86" };
}

function normalizePhoneNumber(value: string): string {
  const normalized = value.trim().replace(/[^\d+]/g, "");
  return /^\+?\d{5,20}$/.test(normalized) ? normalized : "";
}

function normalizeCountryCode(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\D/g, "");
  return normalized ? normalized.slice(0, 8) : null;
}
