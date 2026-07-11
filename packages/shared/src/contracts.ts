export type IsoDateTime = string;

export type MembershipStatus = "FREE" | "VIP_ACTIVE" | "VIP_EXPIRED";

export interface MembershipSummary {
  status: MembershipStatus;
  isVip: boolean;
  expiresAt: IsoDateTime | null;
  collectionLimit: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: IsoDateTime;
  membership: MembershipSummary;
}

export type AlbumRarity = "N" | "R" | "SR" | "SSR" | "UR";
export type AlbumSource = "CATALOG" | "USER_CREATED";

export interface AlbumTrack {
  position: number;
  title: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  releaseYear: number | null;
  genre: string | null;
  coverUrl: string | null;
  rarity: AlbumRarity;
  source: AlbumSource;
  createdBy: string | null;
  createdAt: IsoDateTime;
  tracks?: AlbumTrack[];
}

export interface CollectionRecord {
  id: string;
  userId: string;
  albumId: string;
  album: Album;
  purchasePriceCents: number | null;
  collectedAt: IsoDateTime;
  note: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type TvDeviceStatus = "BOUND" | "UNBOUND" | "DISABLED";

export interface TvDevice {
  id: string;
  userId: string;
  name: string;
  status: TvDeviceStatus;
  lastSyncedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationMeta extends PaginationParams {
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function createPaginationMeta({
  page,
  pageSize,
  totalItems,
}: PaginationParams & { totalItems: number }): PaginationMeta {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
  };
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "COLLECTION_LIMIT_REACHED"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export function createApiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): ApiErrorResponse {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}
