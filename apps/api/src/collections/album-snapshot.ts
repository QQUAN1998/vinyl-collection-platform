import type { CloudAlbum } from "@vinyl/shared";

import type { Album, AlbumTrack, Collection, Prisma } from "../generated/prisma/client.js";

export type CollectionWithAlbum = Collection & { album: Album & { tracks?: AlbumTrack[] } };

export function toAlbumOverrideJson(album: CloudAlbum): Prisma.InputJsonValue {
  return {
    id: album.id,
    title: album.title,
    artist: album.artist,
    year: album.year,
    region: album.region,
    style: album.style,
    coverUrl: album.coverUrl,
    tracks: album.tracks.map((track) => ({
      position: track.position,
      title: track.title,
    })),
  } as Prisma.InputJsonValue;
}

export function resolveCollectionAlbum(
  album: Album & { tracks?: AlbumTrack[] },
  override: unknown,
): CloudAlbum {
  const base = toBaseAlbum(album);
  if (!isRecord(override)) {
    return base;
  }

  return {
    id: base.id,
    title: readString(override["title"]) || base.title,
    artist: readString(override["artist"]) || base.artist,
    year: readOptionalNumber(override["year"], base.year),
    region: readOptionalString(override["region"], base.region),
    style: readOptionalString(override["style"], base.style),
    coverUrl: readOptionalString(override["coverUrl"], base.coverUrl),
    tracks: readTracks(override["tracks"], base.tracks),
  };
}

function toBaseAlbum(album: Album & { tracks?: AlbumTrack[] }): CloudAlbum {
  return {
    id: album.id,
    title: album.title,
    artist: album.artist,
    year: album.releaseYear,
    region: null,
    style: album.genre,
    coverUrl: album.coverUrl,
    tracks: (album.tracks ?? []).map((track) => ({
      position: track.position,
      title: track.title,
    })),
  };
}

function readTracks(value: unknown, fallback: CloudAlbum["tracks"]): CloudAlbum["tracks"] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .slice(0, 80)
    .map((track, index) => {
      if (!isRecord(track)) return null;
      const title = readString(track["title"]);
      if (!title) return null;
      return {
        position: readPositiveInteger(track["position"]) || index + 1,
        title: title.slice(0, 200),
      };
    })
    .filter((track): track is { position: number; title: string } => Boolean(track))
    .sort((left, right) => left.position - right.position);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : fallback;
}

function readOptionalNumber(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readPositiveInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
