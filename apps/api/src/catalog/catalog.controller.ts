import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  CatalogAlbumCandidate,
  CatalogProvider,
  CatalogSearchResponse,
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
  return Math.min(limit, 100);
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
