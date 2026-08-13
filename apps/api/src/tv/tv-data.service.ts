import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "../database/prisma.service.js";
import { AuditActorType, TvDeviceStatus } from "../generated/prisma/enums.js";
import type { User } from "../generated/prisma/client.js";
import {
  type CollectionWithAlbum,
  resolveCollectionAlbum,
} from "../collections/album-snapshot.js";
import {
  type WechatCloudStorageUrlClient,
  WECHAT_CLOUD_STORAGE_URL_CLIENT,
} from "./wechat-cloud-storage-url.client.js";

const TV_LOGIN_ACTION = "tv_login_session";
const SESSION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_EXTERNAL_TV_BASE_URL = "https://lcnr7v37iwv6.aiforce.cloud/app/app_179nj1yqh54";

export interface TvLoginSessionResponse {
  code: string;
  scanUrl: string;
  expiresAt: string;
}

export interface TvLoginStatusResponse {
  code: string;
  status: "pending" | "confirmed" | "expired";
  userId: string;
  userName: string;
  expiresAt: string;
}

export interface TvLibraryResponse {
  albums: TvAlbumResponse[];
  summary: {
    albumCount: number;
    songCount: number;
    artistCount: number;
    quantity: number;
    totalPrice: number;
    averagePrice: number;
    maxPrice: number;
  };
}

export interface TvExternalConfirmResponse {
  code: string;
  status: "pending" | "confirmed" | "expired";
  userId: string;
  userName: string;
  expiresAt: string;
  syncedAlbumCount: number;
}

interface TvAlbumResponse {
  id: string;
  title: string;
  artist: string;
  region: string;
  style: string;
  source: string;
  notes: string;
  cover: string;
  year: number;
  decade: string;
  collectionDate: string;
  collectionYear: number;
  condition: string;
  quantity: number;
  price: number;
  songCount: number;
  duration: number;
  songStyles: string[];
  songs: Array<{
    title: string;
    artist: string;
    duration: number;
    orderNumber: number;
  }>;
}

@Injectable()
export class TvDataService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(WECHAT_CLOUD_STORAGE_URL_CLIENT)
    private readonly cloudStorageUrls: WechatCloudStorageUrlClient,
  ) {}

  async createLoginSession(baseUrl: string, now = new Date()): Promise<TvLoginSessionResponse> {
    const code = await this.createUniqueCode();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

    await this.prisma.auditLog.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        actorId: code,
        action: TV_LOGIN_ACTION,
        reason: "pending",
        metadata: {
          code,
          status: "pending",
          expiresAt,
        },
      },
    });

    return {
      code,
      scanUrl: `${baseUrl.replace(/\/+$/, "")}/cloud/vinyl-data/tv-login/${code}/scan`,
      expiresAt,
    };
  }

  async getLoginSession(code: string, now = new Date()): Promise<TvLoginStatusResponse> {
    const record = await this.findSessionRecord(code);
    const metadata = parseSessionMetadata(record.metadata);
    const expiresAt = metadata.expiresAt || record.createdAt.toISOString();
    const isExpired = metadata.status !== "confirmed" && new Date(expiresAt).getTime() <= now.getTime();

    return {
      code: metadata.code || normalizeCode(code),
      status: isExpired ? "expired" : metadata.status,
      userId: metadata.userId || "",
      userName: metadata.userName || "",
      expiresAt,
    };
  }

  async confirmLoginSession(
    code: string,
    body: unknown,
    userFromIdentity?: User,
    now = new Date(),
  ): Promise<TvLoginStatusResponse> {
    const record = await this.findSessionRecord(code);
    const metadata = parseSessionMetadata(record.metadata);
    const expiresAt = metadata.expiresAt || record.createdAt.toISOString();
    if (metadata.status !== "confirmed" && new Date(expiresAt).getTime() <= now.getTime()) {
      throw new ConflictException();
    }

    const payload = parseConfirmPayload(body);
    const user = userFromIdentity || await this.requireUserById(payload.userId);
    const userName = payload.userName || user.displayName || "唱片柜用户";
    const confirmedAt = now.toISOString();

    await this.prisma.auditLog.update({
      where: { id: record.id },
      data: {
        userId: user.id,
        reason: "confirmed",
        metadata: {
          ...metadata,
          code: normalizeCode(code),
          status: "confirmed",
          userId: user.id,
          userName,
          confirmedAt,
          albumCount: payload.albumCount,
        },
      },
    });

    await this.prisma.tvDevice.upsert({
      where: { deviceKeyHash: hashDeviceKey(normalizeCode(code)) },
      create: {
        userId: user.id,
        name: payload.deviceName || "David唱片柜 TV",
        deviceKeyHash: hashDeviceKey(normalizeCode(code)),
        status: TvDeviceStatus.BOUND,
        lastSyncedAt: now,
      },
      update: {
        userId: user.id,
        status: TvDeviceStatus.BOUND,
        lastSyncedAt: now,
      },
    });

    return {
      code: normalizeCode(code),
      status: "confirmed",
      userId: user.id,
      userName,
      expiresAt,
    };
  }

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
    const confirmUrl = buildExternalConfirmUrl(normalizedCode);
    const response = await fetch(confirmUrl, {
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
      syncedAlbumCount: payload.albumCount,
    };
  }

  async getLibraryForUser(userId: string): Promise<TvLibraryResponse> {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) {
      return emptyLibrary();
    }

    const user = await this.prisma.user.findUnique({ where: { id: normalizedUserId } });
    if (!user) {
      return emptyLibrary();
    }

    const records = await this.prisma.collection.findMany({
      where: { userId: user.id },
      include: {
        album: {
          include: {
            tracks: { orderBy: { position: "asc" } },
          },
        },
      },
      orderBy: [{ collectedAt: "desc" }, { createdAt: "desc" }],
    });

    const albums = records.map(toTvAlbum);
    await resolveCloudAlbumCovers(albums, this.cloudStorageUrls);
    return {
      albums,
      summary: summarizeTvAlbums(albums),
    };
  }

  private async createUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomBytes(4).toString("hex").toUpperCase();
      const existing = await this.prisma.auditLog.findFirst({
        where: { action: TV_LOGIN_ACTION, actorId: code },
      });
      if (!existing) {
        return code;
      }
    }
    throw new ConflictException();
  }

  private async findSessionRecord(code: string) {
    const normalized = normalizeCode(code);
    if (!normalized) {
      throw new NotFoundException();
    }

    const record = await this.prisma.auditLog.findFirst({
      where: { action: TV_LOGIN_ACTION, actorId: normalized },
      orderBy: { createdAt: "desc" },
    });
    if (!record) {
      throw new NotFoundException();
    }
    return record;
  }

  private async requireUserById(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnprocessableEntityException();
    }
    return user;
  }
}

async function resolveCloudAlbumCovers(
  albums: TvAlbumResponse[],
  client: WechatCloudStorageUrlClient,
): Promise<void> {
  const fileIds = albums.map((album) => album.cover).filter((cover) => cover.startsWith("cloud://"));
  if (!fileIds.length) {
    return;
  }

  const resolved = await client.resolve(fileIds).catch(() => new Map<string, string>());
  for (const album of albums) {
    album.cover = resolved.get(album.cover) || album.cover;
  }
}

function normalizeCode(value: string): string {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
    throw new NotFoundException();
  }
  return code;
}

function parseSessionMetadata(value: unknown): {
  code: string;
  status: "pending" | "confirmed";
  expiresAt: string;
  userId?: string;
  userName?: string;
  confirmedAt?: string;
  albumCount?: number;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NotFoundException();
  }

  const record = value as Record<string, unknown>;
  const status = record["status"] === "confirmed" ? "confirmed" : "pending";
  return {
    code: typeof record["code"] === "string" ? record["code"] : "",
    status,
    expiresAt: typeof record["expiresAt"] === "string" ? record["expiresAt"] : "",
    ...(typeof record["userId"] === "string" ? { userId: record["userId"] } : {}),
    ...(typeof record["userName"] === "string" ? { userName: record["userName"] } : {}),
    ...(typeof record["confirmedAt"] === "string" ? { confirmedAt: record["confirmedAt"] } : {}),
    ...(typeof record["albumCount"] === "number" ? { albumCount: record["albumCount"] } : {}),
  };
}

function parseConfirmPayload(value: unknown): {
  userId: string;
  userName: string;
  deviceName: string;
  albumCount: number;
  albums: unknown[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UnprocessableEntityException();
  }
  const body = value as Record<string, unknown>;
  const userId = typeof body["userId"] === "string" ? body["userId"].trim() : "";
  if (!userId) {
    throw new UnprocessableEntityException();
  }
  const albums = Array.isArray(body["albums"]) ? body["albums"] : [];
  return {
    userId,
    userName: typeof body["userName"] === "string" ? body["userName"].trim().slice(0, 64) : "",
    deviceName: typeof body["deviceName"] === "string" ? body["deviceName"].trim().slice(0, 80) : "",
    albumCount: albums.length,
    albums,
  };
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

function toTvAlbum(record: CollectionWithAlbum): TvAlbumResponse {
  const album = resolveCollectionAlbum(record.album, record.albumOverride);
  const year = album.year || 0;
  const tracks = album.tracks || [];
  const collectionDate = record.collectedAt.toISOString().slice(0, 10);
  const style = album.style || "未分类";
  const price = record.purchasePriceCents === null
    ? 0
    : Number((record.purchasePriceCents / 100).toFixed(2));

  return {
    id: album.id,
    title: album.title,
    artist: album.artist,
    region: "未记录",
    style,
    source: record.source || "小程序同步",
    notes: record.note || "",
    cover: normalizeCover(album.coverUrl),
    year,
    decade: year ? `${Math.floor(year / 10) * 10}s` : "未知",
    collectionDate,
    collectionYear: Number(collectionDate.slice(0, 4)) || new Date().getFullYear(),
    condition: record.condition || "",
    quantity: record.quantity || 1,
    price,
    songCount: tracks.length,
    duration: 0,
    songStyles: [style],
    songs: tracks.map((track) => ({
      title: track.title,
      artist: album.artist,
      duration: 0,
      orderNumber: track.position,
    })),
  };
}

function normalizeCover(value: string | null): string {
  const cover = String(value || "").trim();
  if (!cover) {
    return "";
  }
  if (/^(https?:|data:)/.test(cover)) {
    return cover;
  }
  return cover.replace(/^\/+/, "");
}

function summarizeTvAlbums(albums: TvAlbumResponse[]): TvLibraryResponse["summary"] {
  const quantity = albums.reduce((sum, album) => sum + Math.max(1, Number(album.quantity || 1)), 0);
  const totalPrice = albums.reduce(
    (sum, album) => sum + Number(album.price || 0) * Math.max(1, Number(album.quantity || 1)),
    0,
  );
  const artists = new Set(albums.map((album) => album.artist).filter(Boolean));
  return {
    albumCount: albums.length,
    songCount: albums.reduce((sum, album) => sum + album.songCount, 0),
    artistCount: artists.size,
    quantity,
    totalPrice: Number(totalPrice.toFixed(2)),
    averagePrice: quantity ? Number((totalPrice / quantity).toFixed(2)) : 0,
    maxPrice: albums.reduce((max, album) => Math.max(max, Number(album.price || 0)), 0),
  };
}

function emptyLibrary(): TvLibraryResponse {
  return {
    albums: [],
    summary: {
      albumCount: 0,
      songCount: 0,
      artistCount: 0,
      quantity: 0,
      totalPrice: 0,
      averagePrice: 0,
      maxPrice: 0,
    },
  };
}

function hashDeviceKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
