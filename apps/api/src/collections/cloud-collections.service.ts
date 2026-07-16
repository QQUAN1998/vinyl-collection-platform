import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  BatchUpsertCloudCollectionInput,
  CloudAlbum,
  CloudCollectionItem,
  CloudCollectionPayload,
  UpsertCloudCollectionInput,
} from "@vinyl/shared";

import { PrismaService } from "../database/prisma.service.js";
import { AlbumSource } from "../generated/prisma/enums.js";
import type { Album, AlbumTrack, Collection, User } from "../generated/prisma/client.js";

type CollectionWithAlbum = Collection & { album: Album & { tracks?: AlbumTrack[] } };
type CollectionPrismaClient = Pick<PrismaService, "album" | "collection">;

const DEFAULT_MEDIUM_KEY = "vinyl";
const DEFAULT_CONDITION = "NM";
const MAX_BATCH_UPSERT_ITEMS = 500;

@Injectable()
export class CloudCollectionsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listForUser(user: User): Promise<CloudCollectionPayload> {
    const collectionItems = await this.prisma.collection.findMany({
      where: { userId: user.id },
      include: collectionAlbumInclude,
      orderBy: [{ collectedAt: "desc" }, { createdAt: "desc" }],
    });

    return toCollectionPayload(user, collectionItems);
  }

  async listSharedCollection(ownerId: string): Promise<CloudCollectionPayload> {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) {
      throw new NotFoundException();
    }

    return this.listForUser(owner);
  }

  async upsertForUser(user: User, body: unknown): Promise<CloudCollectionPayload> {
    const input = parseUpsertInput(body);
    await this.upsertOneForUser(this.prisma, user, input);

    return this.listForUser(user);
  }

  async upsertManyForUser(user: User, body: unknown): Promise<CloudCollectionPayload> {
    const inputs = parseBatchUpsertInput(body);

    await this.prisma.$transaction(async (client) => {
      for (const input of inputs) {
        await this.upsertOneForUser(client, user, input);
      }
    });

    return this.listForUser(user);
  }

  async patchForUser(user: User, collectionId: string, body: unknown): Promise<CloudCollectionPayload> {
    const existing = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: collectionAlbumInclude,
    });
    if (!existing || existing.userId !== user.id) {
      throw new NotFoundException();
    }

    await this.prisma.collection.update({
      where: { id: collectionId },
      data: toCollectionPatchData(parseCollectionPatch(body)),
      include: collectionAlbumInclude,
    });

    return this.listForUser(user);
  }

  async deleteForUser(user: User, collectionId: string): Promise<CloudCollectionPayload> {
    const existing = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: collectionAlbumInclude,
    });
    if (!existing || existing.userId !== user.id) {
      throw new NotFoundException();
    }

    await this.prisma.collection.delete({ where: { id: collectionId } });

    return this.listForUser(user);
  }

  private async upsertOneForUser(
    client: CollectionPrismaClient,
    user: User,
    input: UpsertCloudCollectionInput,
  ): Promise<void> {
    await client.album.upsert({
      where: { id: input.album.id },
      create: {
        id: input.album.id,
        title: input.album.title,
        artist: input.album.artist,
        releaseYear: input.album.year,
        genre: input.album.style,
        coverUrl: input.album.coverUrl,
        source: input.album.id.startsWith("manual-") ? AlbumSource.USER_CREATED : AlbumSource.CATALOG,
        createdById: user.id,
        tracks: { create: input.album.tracks },
      },
      update: {
        title: input.album.title,
        artist: input.album.artist,
        releaseYear: input.album.year,
        genre: input.album.style,
        coverUrl: input.album.coverUrl,
        tracks: {
          deleteMany: {},
          create: input.album.tracks,
        },
      },
    });

    await client.collection.upsert({
      where: { userId_albumId: { userId: user.id, albumId: input.album.id } },
      create: {
        userId: user.id,
        albumId: input.album.id,
        ...toCollectionData(input.collection),
      },
      update: toCollectionData(input.collection),
      include: collectionAlbumInclude,
    });
  }
}

const collectionAlbumInclude = {
  album: {
    include: {
      tracks: { orderBy: { position: "asc" } },
    },
  },
} as const;

function parseUpsertInput(body: unknown): UpsertCloudCollectionInput {
  if (typeof body !== "object" || body === null) {
    throw new UnprocessableEntityException();
  }

  const value = body as Record<string, unknown>;
  return {
    album: parseAlbum(value["album"]),
    collection: parseCollection(value["collection"]),
  };
}

function parseBatchUpsertInput(body: unknown): BatchUpsertCloudCollectionInput["items"] {
  if (typeof body !== "object" || body === null) {
    throw new UnprocessableEntityException();
  }

  const value = body as Record<string, unknown>;
  const items = value["items"];
  if (!Array.isArray(items) || !items.length || items.length > MAX_BATCH_UPSERT_ITEMS) {
    throw new UnprocessableEntityException();
  }

  return items.map(parseUpsertInput);
}

function parseAlbum(value: unknown): CloudAlbum {
  if (typeof value !== "object" || value === null) {
    throw new UnprocessableEntityException();
  }

  const album = value as Record<string, unknown>;
  const id = requiredString(album["id"], 191);
  const title = requiredString(album["title"], 200);
  const artist = requiredString(album["artist"], 160);
  const year = optionalYear(album["year"]);

  return {
    id,
    title,
    artist,
    year,
    region: optionalString(album["region"], 80),
    style: optionalString(album["style"], 80),
    coverUrl: optionalString(album["coverUrl"], 2048),
    tracks: parseTracks(album["tracks"]),
  };
}

function parseCollection(value: unknown): UpsertCloudCollectionInput["collection"] {
  if (typeof value !== "object" || value === null) {
    throw new UnprocessableEntityException();
  }

  const collection = value as Record<string, unknown>;
  return {
    collectionDate: parseDay(collection["collectionDate"]) ?? today(),
    source: optionalString(collection["source"], 80) ?? "",
    quantity: optionalPositiveInteger(collection["quantity"]) ?? 1,
    condition: optionalString(collection["condition"], 32) ?? DEFAULT_CONDITION,
    mediumKey: optionalString(collection["mediumKey"], 32) ?? DEFAULT_MEDIUM_KEY,
    price: optionalPrice(collection["price"]),
    notes: optionalString(collection["notes"], 2000) ?? "",
  };
}

function parseCollectionPatch(value: unknown): Partial<UpsertCloudCollectionInput["collection"]> {
  if (typeof value !== "object" || value === null) {
    throw new UnprocessableEntityException();
  }

  const collection = value as Record<string, unknown>;
  return {
    ...(collection["collectionDate"] === undefined
      ? {}
      : { collectionDate: parseDay(collection["collectionDate"]) ?? today() }),
    ...(collection["source"] === undefined ? {} : { source: optionalString(collection["source"], 80) ?? "" }),
    ...(collection["quantity"] === undefined
      ? {}
      : { quantity: optionalPositiveInteger(collection["quantity"]) ?? 1 }),
    ...(collection["condition"] === undefined
      ? {}
      : { condition: optionalString(collection["condition"], 32) ?? DEFAULT_CONDITION }),
    ...(collection["mediumKey"] === undefined
      ? {}
      : { mediumKey: optionalString(collection["mediumKey"], 32) ?? DEFAULT_MEDIUM_KEY }),
    ...(collection["price"] === undefined ? {} : { price: optionalPrice(collection["price"]) }),
    ...(collection["notes"] === undefined ? {} : { notes: optionalString(collection["notes"], 2000) ?? "" }),
  };
}

function parseTracks(value: unknown): CloudAlbum["tracks"] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new UnprocessableEntityException();
  }

  return value.slice(0, 80).map((track, index) => {
    if (typeof track === "string") {
      return { position: index + 1, title: track.slice(0, 200) };
    }
    if (typeof track === "object" && track !== null) {
      const record = track as Record<string, unknown>;
      return {
        position: optionalPositiveInteger(record["position"]) ?? index + 1,
        title: requiredString(record["title"], 200),
      };
    }
    throw new UnprocessableEntityException();
  });
}

function toCollectionData(collection: UpsertCloudCollectionInput["collection"]) {
  return {
    collectedAt: new Date(`${collection.collectionDate}T00:00:00.000Z`),
    source: collection.source,
    quantity: collection.quantity,
    condition: collection.condition,
    mediumKey: collection.mediumKey,
    purchasePriceCents:
      collection.price === undefined ? null : Math.round(Number(collection.price) * 100),
    note: collection.notes,
  };
}

function toCollectionPatchData(collection: Partial<UpsertCloudCollectionInput["collection"]>) {
  return {
    ...(collection.collectionDate === undefined
      ? {}
      : { collectedAt: new Date(`${collection.collectionDate}T00:00:00.000Z`) }),
    ...(collection.source === undefined ? {} : { source: collection.source }),
    ...(collection.quantity === undefined ? {} : { quantity: collection.quantity }),
    ...(collection.condition === undefined ? {} : { condition: collection.condition }),
    ...(collection.mediumKey === undefined ? {} : { mediumKey: collection.mediumKey }),
    ...(collection.price === undefined
      ? {}
      : { purchasePriceCents: collection.price === undefined ? null : Math.round(collection.price * 100) }),
    ...(collection.notes === undefined ? {} : { note: collection.notes }),
  };
}

function toCollectionPayload(
  owner: User,
  records: CollectionWithAlbum[],
): CloudCollectionPayload {
  const albumsById = new Map<string, CloudAlbum>();
  const collectionItems: CloudCollectionItem[] = records.map((record) => {
    albumsById.set(record.albumId, toCloudAlbum(record.album));
    return toCloudCollectionItem(record);
  });

  return {
    owner: {
      id: owner.id,
      displayName: owner.displayName,
      avatarUrl: owner.avatarUrl,
    },
    albums: [...albumsById.values()],
    collectionItems,
  };
}

function toCloudAlbum(album: Album & { tracks?: AlbumTrack[] }): CloudAlbum {
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

function toCloudCollectionItem(record: CollectionWithAlbum): CloudCollectionItem {
  return {
    id: record.id,
    userId: record.userId,
    albumId: record.albumId,
    collectionDate: dateToDay(record.collectedAt),
    source: record.source ?? "",
    quantity: record.quantity,
    condition: record.condition ?? "",
    mediumKey: record.mediumKey ?? DEFAULT_MEDIUM_KEY,
    price:
      record.purchasePriceCents === null
        ? undefined
        : Number((record.purchasePriceCents / 100).toFixed(2)),
    notes: record.note ?? "",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function requiredString(value: unknown, maxLength: number): string {
  const text = optionalString(value, maxLength);
  if (!text) {
    throw new UnprocessableEntityException();
  }
  return text;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new UnprocessableEntityException();
  }
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function optionalYear(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1800 || year > 3000) {
    throw new UnprocessableEntityException();
  }
  return year;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new UnprocessableEntityException();
  }
  return number;
}

function optionalPrice(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new UnprocessableEntityException();
  }
  return number;
}

function parseDay(value: unknown): string | null {
  const text = optionalString(value, 10);
  if (text === null) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00.000Z`))) {
    throw new UnprocessableEntityException();
  }
  return text;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateToDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}
