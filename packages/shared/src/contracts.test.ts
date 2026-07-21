import { describe, expect, it } from "vitest";

import {
  createApiError,
  createPaginationMeta,
  type Album,
  type BatchUpsertCloudCollectionInput,
  type CollectionRecord,
  type MembershipSummary,
  type TvDevice,
  type UserProfile,
} from "./contracts.js";

describe("createPaginationMeta", () => {
  it("calculates a stable pagination response", () => {
    expect(createPaginationMeta({ page: 2, pageSize: 20, totalItems: 41 })).toEqual({
      page: 2,
      pageSize: 20,
      totalItems: 41,
      totalPages: 3,
    });
  });

  it("keeps an empty result on page one", () => {
    expect(createPaginationMeta({ page: 1, pageSize: 20, totalItems: 0 })).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
  });
});

describe("createApiError", () => {
  it("uses the same nested error envelope for every client", () => {
    expect(
      createApiError("COLLECTION_LIMIT_REACHED", "Collection limit reached", {
        collectionLimit: 10,
      }),
    ).toEqual({
      error: {
        code: "COLLECTION_LIMIT_REACHED",
        message: "Collection limit reached",
        details: { collectionLimit: 10 },
      },
    });
  });

  it("omits details when they are not needed", () => {
    expect(createApiError("NOT_FOUND", "Resource not found")).toEqual({
      error: { code: "NOT_FOUND", message: "Resource not found" },
    });
  });
});

describe("shared domain contracts", () => {
  it("describe data that can cross the mini program, API, and TV boundary", () => {
    const membership: MembershipSummary = {
      status: "VIP_ACTIVE",
      isVip: true,
      expiresAt: "2027-07-11T00:00:00.000Z",
      collectionLimit: 10_000,
    };
    const user: UserProfile = {
      id: "user-1",
      displayName: "David",
      avatarUrl: null,
      hasPhoneNumber: true,
      phoneNumberMasked: "138****8000",
      phoneCountryCode: "86",
      phoneAuthorizedAt: "2026-07-11T00:00:00.000Z",
      createdAt: "2026-07-11T00:00:00.000Z",
      membership,
    };
    const album: Album = {
      id: "album-1",
      title: "Memories",
      artist: "Andy Lau",
      releaseYear: 1995,
      genre: "Mandopop",
      coverUrl: null,
      rarity: "UR",
      source: "CATALOG",
      createdBy: null,
      createdAt: "2026-07-11T00:00:00.000Z",
    };
    const collection: CollectionRecord = {
      id: "collection-1",
      userId: user.id,
      albumId: album.id,
      album,
      purchasePriceCents: 970_000,
      collectedAt: "2025-05-01T00:00:00.000Z",
      note: null,
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z",
    };
    const batchUpsert: BatchUpsertCloudCollectionInput = {
      items: [
        {
          album: {
            id: "cloud-album-1",
            title: "Cloud Album",
            artist: "Cloud Artist",
            year: 2026,
            region: "CN",
            style: "Pop",
            coverUrl: "https://example.com/cloud.jpg",
            tracks: [{ position: 1, title: "Opening" }],
          },
          collection: {
            collectionDate: "2026-07-16",
            source: "批量导入",
            quantity: 1,
            condition: "NM",
            mediumKey: "vinyl",
            price: 128,
            notes: "",
          },
        },
      ],
    };
    const tvDevice: TvDevice = {
      id: "device-1",
      userId: user.id,
      name: "Living Room TV",
      status: "BOUND",
      lastSyncedAt: null,
      createdAt: "2026-07-11T00:00:00.000Z",
    };

    expect({ user, collection, batchUpsert, tvDevice }).toMatchObject({
      user: { membership: { collectionLimit: 10_000 } },
      collection: { album: { rarity: "UR" }, purchasePriceCents: 970_000 },
      batchUpsert: { items: [{ album: { id: "cloud-album-1" }, collection: { mediumKey: "vinyl" } }] },
      tvDevice: { status: "BOUND" },
    });
  });
});
