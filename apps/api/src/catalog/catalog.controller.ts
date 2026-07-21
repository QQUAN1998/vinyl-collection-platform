import {
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Query,
  Res,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Readable } from "node:stream";
import type {
  CatalogAlbumCandidate,
  CatalogProvider,
  CatalogSearchResponse,
  CatalogTrackPreviewResponse,
} from "@vinyl/shared";

import { CatalogService } from "./catalog.service.js";

@Controller("api/catalog")
export class CatalogController {
  constructor(
    @Inject(CatalogService)
    private readonly catalog: CatalogService,
  ) {}

  @Get("search")
  async search(
    @Query("q") query: string | undefined,
    @Query("artist") artist: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("country") country: string | undefined,
    @Query("includeUnofficial") includeUnofficial: string | undefined,
  ): Promise<CatalogSearchResponse> {
    return this.catalog.search({
      query: parseRequiredText(query, 120),
      artist: parseOptionalText(artist, 120),
      limit: parseLimit(limit),
      country: parseOptionalText(country, 2)?.toUpperCase() ?? "CN",
      includeUnofficial: parseBoolean(includeUnofficial, true),
    });
  }

  @Get("preview")
  async preview(
    @Query("track") track: string | undefined,
    @Query("artist") artist: string | undefined,
    @Query("album") album: string | undefined,
    @Query("country") country: string | undefined,
  ): Promise<CatalogTrackPreviewResponse> {
    return this.catalog.findTrackPreview({
      track: parseRequiredText(track, 200),
      artist: parseOptionalText(artist, 160),
      album: parseOptionalText(album, 200),
      country: parseOptionalText(country, 2)?.toUpperCase() ?? "CN",
    });
  }

  @Get("preview/stream")
  async streamPreview(
    @Query("track") track: string | undefined,
    @Query("artist") artist: string | undefined,
    @Query("album") album: string | undefined,
    @Query("country") country: string | undefined,
    @Headers("range") range: string | undefined,
    @Res() response: PreviewStreamResponse,
  ): Promise<void> {
    const preview = await this.catalog.findTrackPreview({
      track: parseRequiredText(track, 200),
      artist: parseOptionalText(artist, 160),
      album: parseOptionalText(album, 200),
      country: parseOptionalText(country, 2)?.toUpperCase() ?? "CN",
    });

    if (!preview.ok || !preview.previewUrl) {
      throw new NotFoundException();
    }

    const audioResponse = await fetch(preview.previewUrl, {
      headers: {
        Accept: "audio/*,*/*;q=0.8",
        ...(range ? { Range: range } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!audioResponse.ok || !audioResponse.body) {
      throw new NotFoundException();
    }

    response.status(audioResponse.status === 206 ? 206 : 200);
    copyAudioHeader(audioResponse, response, "content-type", "audio/mp4");
    copyAudioHeader(audioResponse, response, "content-length");
    copyAudioHeader(audioResponse, response, "content-range");
    copyAudioHeader(audioResponse, response, "accept-ranges", "bytes");
    response.setHeader("cache-control", "public, max-age=86400");

    const body = Readable.fromWeb(audioResponse.body as Parameters<typeof Readable.fromWeb>[0]);
    await new Promise<void>((resolve, reject) => {
      body.on("error", reject);
      response.on("finish", resolve);
      response.on("error", reject);
      body.pipe(response);
    });
  }

  @Get("albums/:provider/:providerId")
  async getAlbum(
    @Param("provider") provider: string,
    @Param("providerId") providerId: string,
    @Query("country") country: string | undefined,
    @Query("includeUnofficial") includeUnofficial: string | undefined,
  ): Promise<CatalogAlbumCandidate> {
    const album = await this.catalog.getAlbum({
      provider: parseProvider(provider),
      providerId: parseRequiredText(providerId, 120),
      country: parseOptionalText(country, 2)?.toUpperCase() ?? "CN",
      includeUnofficial: parseBoolean(includeUnofficial, true),
    });

    if (!album) {
      throw new NotFoundException();
    }

    return album;
  }
}

type PreviewStreamResponse = NodeJS.WritableStream & {
  status(statusCode: number): PreviewStreamResponse;
  setHeader(name: string, value: string): void;
};

function copyAudioHeader(
  source: Response,
  target: PreviewStreamResponse,
  name: string,
  fallback?: string,
): void {
  const value = source.headers.get(name) ?? fallback;
  if (value) {
    target.setHeader(name, value);
  }
}

function parseProvider(value: string): CatalogProvider {
  const provider = value.trim().toUpperCase();
  if (
    provider === "MUSICBRAINZ" ||
    provider === "ITUNES" ||
    provider === "NETEASE" ||
    provider === "QQMUSIC" ||
    provider === "DISCOGS"
  ) {
    return provider;
  }
  throw new UnprocessableEntityException();
}

function parseRequiredText(value: string | undefined, maxLength: number): string {
  const text = parseOptionalText(value, maxLength);
  if (!text) {
    throw new UnprocessableEntityException();
  }
  return text;
}

function parseOptionalText(value: string | undefined, maxLength: number): string | null {
  if (value === undefined) {
    return null;
  }
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function parseLimit(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 8;
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new UnprocessableEntityException();
  }
  return Math.min(limit, 300);
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  throw new UnprocessableEntityException();
}
