import { Injectable, ServiceUnavailableException } from "@nestjs/common";

export const WECHAT_CLOUD_STORAGE_URL_CLIENT = Symbol("WECHAT_CLOUD_STORAGE_URL_CLIENT");

export interface WechatCloudStorageUrlClient {
  resolve(fileIds: string[]): Promise<Map<string, string>>;
}

interface AccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
}

interface BatchDownloadResponse {
  errcode?: number;
  file_list?: Array<{
    fileid?: string;
    download_url?: string;
    status?: number;
  }>;
}

const DEFAULT_CLOUD_ENV = "prod-d5gmzcuby62751753";
const TEMP_URL_MAX_AGE_SECONDS = 7200;
const BATCH_SIZE = 50;
const TEMP_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000;

@Injectable()
export class WechatApiCloudStorageUrlClient implements WechatCloudStorageUrlClient {
  private cachedAccessToken: { value: string; expiresAtMs: number } | null = null;
  private readonly cachedUrls = new Map<string, { value: string; expiresAtMs: number }>();

  async resolve(fileIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(fileIds.map((value) => value.trim()).filter(isCloudFileId))];
    if (!uniqueIds.length) {
      return new Map();
    }

    const now = Date.now();
    const resolved = new Map<string, string>();
    const unresolved = uniqueIds.filter((fileId) => {
      const cached = this.cachedUrls.get(fileId);
      if (!cached || cached.expiresAtMs <= now + TEMP_URL_REFRESH_BUFFER_MS) {
        return true;
      }
      resolved.set(fileId, cached.value);
      return false;
    });
    if (!unresolved.length) {
      return resolved;
    }

    const accessToken = await this.getAccessToken();
    for (let index = 0; index < unresolved.length; index += BATCH_SIZE) {
      const batch = unresolved.slice(index, index + BATCH_SIZE);
      const response = await fetch(
        `https://api.weixin.qq.com/tcb/batchdownloadfile?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            env: process.env["WECHAT_CLOUD_ENV"] || DEFAULT_CLOUD_ENV,
            file_list: batch.map((fileid) => ({
              fileid,
              max_age: TEMP_URL_MAX_AGE_SECONDS,
            })),
          }),
        },
      );
      if (!response.ok) {
        throw new ServiceUnavailableException();
      }

      const payload = await response.json() as BatchDownloadResponse;
      if (payload.errcode && payload.errcode !== 0) {
        throw new ServiceUnavailableException();
      }
      for (const file of payload.file_list || []) {
        if (file.status === 0 && file.fileid && isHttpUrl(file.download_url)) {
          const url = file.download_url as string;
          resolved.set(file.fileid, url);
          this.cachedUrls.set(file.fileid, {
            value: url,
            expiresAtMs: now + TEMP_URL_MAX_AGE_SECONDS * 1000,
          });
        }
      }
    }
    return resolved;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedAccessToken && this.cachedAccessToken.expiresAtMs > now + 60_000) {
      return this.cachedAccessToken.value;
    }

    const appId = process.env["WECHAT_APP_ID"] ?? process.env["WECHAT_APPID"] ?? process.env["WX_APP_ID"];
    const appSecret = process.env["WECHAT_APP_SECRET"]
      ?? process.env["WECHAT_APPSECRET"]
      ?? process.env["WX_APP_SECRET"];
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException();
    }

    const response = await fetch(
      "https://api.weixin.qq.com/cgi-bin/token"
        + `?grant_type=client_credential&appid=${encodeURIComponent(appId)}`
        + `&secret=${encodeURIComponent(appSecret)}`,
    );
    if (!response.ok) {
      throw new ServiceUnavailableException();
    }
    const payload = await response.json() as AccessTokenResponse;
    if ((payload.errcode && payload.errcode !== 0) || !payload.access_token) {
      throw new ServiceUnavailableException();
    }

    const ttlMs = Math.max(Number(payload.expires_in ?? 7200) - 300, 60) * 1000;
    this.cachedAccessToken = { value: payload.access_token, expiresAtMs: now + ttlMs };
    return payload.access_token;
  }
}

function isCloudFileId(value: string): boolean {
  return value.startsWith("cloud://");
}

function isHttpUrl(value: string | undefined): boolean {
  return /^https?:\/\//.test(value || "");
}
