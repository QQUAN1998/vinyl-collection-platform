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

export interface UserStatsSummary {
  collectionCount: number;
}

export interface MeResponse {
  user: UserProfile;
  stats: UserStatsSummary;
}

export interface AuthLoginResponse {
  token: string;
  me: MeResponse;
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

export interface CloudAlbumTrack {
  position: number;
  title: string;
}

export interface CloudAlbum {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  region: string | null;
  style: string | null;
  coverUrl: string | null;
  tracks: CloudAlbumTrack[];
}

export interface CloudCollectionItem {
  id: string;
  userId: string;
  albumId: string;
  collectionDate: string;
  source: string;
  quantity: number;
  condition: string;
  mediumKey: string;
  price: number | undefined;
  notes: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CloudCollectionOwner {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CloudCollectionPayload {
  owner: CloudCollectionOwner;
  albums: CloudAlbum[];
  collectionItems: CloudCollectionItem[];
}

export interface UpsertCloudCollectionInput {
  album: CloudAlbum;
  collection: Omit<
    CloudCollectionItem,
    "id" | "userId" | "albumId" | "createdAt" | "updatedAt"
  >;
}

export type CatalogProvider =
  | "MUSICBRAINZ"
  | "ITUNES"
  | "NETEASE"
  | "QQMUSIC"
  | "DISCOGS";

export interface CatalogProviderRef {
  provider: CatalogProvider;
  id: string;
  url: string | null;
}

export interface CatalogAlbumTrack {
  position: number;
  title: string;
  durationMs: number | null;
}

export interface CatalogAlbumCandidate {
  id: string;
  provider: CatalogProvider;
  providerId: string;
  title: string;
  artist: string;
  year: number | null;
  releaseDate: string | null;
  region: string | null;
  label: string | null;
  genre: string | null;
  style: string | null;
  format: string | null;
  barcode: string | null;
  coverUrl: string | null;
  coverThumbUrl: string | null;
  trackCount: number | null;
  tracks: CatalogAlbumTrack[];
  externalUrl: string | null;
  score: number;
  providerRefs: CatalogProviderRef[];
}

export interface CatalogSearchResponse {
  query: string;
  artist: string | null;
  providers: {
    enabled: CatalogProvider[];
    failed: CatalogProvider[];
  };
  data: CatalogAlbumCandidate[];
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
