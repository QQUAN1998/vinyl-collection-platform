import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import type { User } from "../generated/prisma/client.js";

const DEFAULT_EXTERNAL_TV_BASE_URL = "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54";

export interface TvExternalConfirmResponse {
  code: string;
  status: "pending" | "confirmed" | "expired";
  userId: string;
  userName: string;
  expiresAt: string;
  syncedAlbumCount: number;
}

@Injectable()
export class TvDataService {
  async proxyConfirmExternalSession(
    code: string,
    body: unknown,
    userFromIdentity?: User,
  ): Promise<TvExternalConfirmResponse> {
    const normalizedCode = normalizeCode(code);
    const payload = parseConfirmPayload(body);
    const userId = userFromIdentity?.id || payload.userId;
    if (!userId) {
      throw new UnprocessableEntityException();
    }

    const userName = payload.userName || userFromIdentity?.displayName || "唱片柜用户";
    const response = await fetch(buildExternalConfirmUrl(normalizedCode), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId,
        userName,
        ...(payload.deviceName ? { deviceName: payload.deviceName } : {}),
        albums: payload.albums,
      }),
    }).catch(() => null);

    if (!response) {
      throw new BadGatewayException();
    }

    const data = await readJsonResponse(response);
    if (!response.ok) {
      throw new BadGatewayException(data);
    }

    return {
      code: typeof data["code"] === "string" ? data["code"] : normalizedCode,
      status: normalizeRemoteStatus(data["status"]),
      userId: typeof data["userId"] === "string" ? data["userId"] : userId,
      userName: typeof data["userName"] === "string" ? data["userName"] : userName,
      expiresAt: typeof data["expiresAt"] === "string" ? data["expiresAt"] : "",
      syncedAlbumCount: payload.albums.length,
    };
  }
}

function parseConfirmPayload(value: unknown): {
  userId: string;
  userName: string;
  deviceName: string;
  albums: unknown[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UnprocessableEntityException();
  }

  const body = value as Record<string, unknown>;
  return {
    userId: typeof body["userId"] === "string" ? body["userId"].trim() : "",
    userName: typeof body["userName"] === "string" ? body["userName"].trim().slice(0, 64) : "",
    deviceName: typeof body["deviceName"] === "string" ? body["deviceName"].trim().slice(0, 80) : "",
    albums: Array.isArray(body["albums"]) ? body["albums"] : [],
  };
}

function normalizeCode(value: string): string {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
    throw new NotFoundException();
  }
  return code;
}

function buildExternalConfirmUrl(code: string): string {
  const baseUrl = String(process.env["TV_LOGIN_CONFIRM_BASE_URL"] || DEFAULT_EXTERNAL_TV_BASE_URL)
    .replace(/\/+$/, "");
  return `${baseUrl}/cloud/vinyl-data/tv-login/session/${encodeURIComponent(code)}/confirm`;
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const data = await response.json();
    return data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function normalizeRemoteStatus(value: unknown): "pending" | "confirmed" | "expired" {
  if (value === "pending" || value === "expired") {
    return value;
  }
  return "confirmed";
}
