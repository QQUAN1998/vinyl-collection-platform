import { Injectable } from "@nestjs/common";
import type {
  CatalogAlbumCandidate,
  CatalogAlbumTrack,
  CatalogProvider,
  CatalogSearchResponse,
} from "@vinyl/shared";

interface CatalogSearchInput {
  query: string;
  artist: string | null;
  limit: number;
  country: string;
  includeUnofficial: boolean;
}

interface CatalogAlbumInput {
  provider: CatalogProvider;
  providerId: string;
  country: string;
  includeUnofficial: boolean;
}

interface ProviderContext {
  userAgent: string;
  discogsToken: string | null;
}

interface ProviderResult {
  provider: CatalogProvider;
  data: CatalogAlbumCandidate[];
}

interface ProviderClient {
  provider: CatalogProvider;
  isEnabled(input: CatalogSearchInput | CatalogAlbumInput, context: ProviderContext): boolean;
  search(input: CatalogSearchInput, context: ProviderContext): Promise<CatalogAlbumCandidate[]>;
  getAlbum(input: CatalogAlbumInput, context: ProviderContext): Promise<CatalogAlbumCandidate | null>;
}

@Injectable()
export class CatalogService {
  private readonly providers: ProviderClient[] = [
    musicBrainzProvider,
    iTunesProvider,
    neteaseProvider,
    qqMusicProvider,
    discogsProvider,
  ];

  async search(input: CatalogSearchInput): Promise<CatalogSearchResponse> {
    const context = createProviderContext();
    const enabledProviders = this.providers.filter((provider) => provider.isEnabled(input, context));
    const results = await Promise.allSettled(
      enabledProviders.map(async (provider): Promise<ProviderResult> => ({
        provider: provider.provider,
        data: await provider.search(input, context),
      })),
    );

    const failed: CatalogProvider[] = [];
    const data: CatalogAlbumCandidate[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        data.push(...result.value.data);
      } else {
        const index = results.indexOf(result);
        const provider = enabledProviders[index]?.provider;
        if (provider) {
          failed.push(provider);
        }
      }
    }

    return {
      query: input.query,
      artist: input.artist,
      providers: {
        enabled: enabledProviders.map((provider) => provider.provider),
        failed,
      },
      data: rankAndDedupe(data, input).slice(0, input.limit),
    };
  }

  async getAlbum(input: CatalogAlbumInput): Promise<CatalogAlbumCandidate | null> {
    const context = createProviderContext();
    const provider = this.providers.find((item) => item.provider === input.provider);
    if (!provider || !provider.isEnabled(input, context)) {
      return null;
    }
    return provider.getAlbum(input, context);
  }
}

const musicBrainzProvider: ProviderClient = {
  provider: "MUSICBRAINZ",
  isEnabled: () => true,
  async search(input, context) {
    const query = buildMusicBrainzSearchQuery(input);
    const url = new URL("https://musicbrainz.org/ws/2/release/");
    url.searchParams.set("query", query);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("limit", String(input.limit));

    const payload = await fetchJson(url, { userAgent: context.userAgent });
    const releases = asArray(readRecord(payload)["releases"]);
    return releases.map((release, index) => mapMusicBrainzRelease(release, index)).filter(isDefined);
  },
  async getAlbum(input, context) {
    const url = new URL(`https://musicbrainz.org/ws/2/release/${encodeURIComponent(input.providerId)}`);
    url.searchParams.set("fmt", "json");
    url.searchParams.set("inc", "artist-credits+labels+media+recordings+release-groups");

    const payload = await fetchJson(url, { userAgent: context.userAgent });
    return mapMusicBrainzRelease(payload, 0);
  },
};

const iTunesProvider: ProviderClient = {
  provider: "ITUNES",
  isEnabled: () => true,
  async search(input) {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", providerSearchTerm(input));
    url.searchParams.set("entity", "album");
    url.searchParams.set("media", "music");
    url.searchParams.set("limit", String(input.limit));
    url.searchParams.set("country", input.country);

    const payload = await fetchJson(url);
    const results = asArray(readRecord(payload)["results"]);
    return results.map((result, index) => mapITunesCollection(result, index, []));
  },
  async getAlbum(input) {
    const url = new URL("https://itunes.apple.com/lookup");
    url.searchParams.set("id", input.providerId);
    url.searchParams.set("entity", "song");
    url.searchParams.set("country", input.country);

    const payload = await fetchJson(url);
    const results = asArray(readRecord(payload)["results"]);
    const collection = results.find((item) => readString(readRecord(item)["wrapperType"]) === "collection");
    if (!collection) {
      return null;
    }
    const tracks = results
      .filter((item) => readString(readRecord(item)["wrapperType"]) === "track")
      .map(mapITunesTrack)
      .filter(isDefined);
    return mapITunesCollection(collection, 0, tracks);
  },
};

const neteaseProvider: ProviderClient = {
  provider: "NETEASE",
  isEnabled: (input) => input.includeUnofficial,
  async search(input) {
    const albums = await searchNeteaseAlbums(input);
    if (!isArtistOnlySearch(input)) {
      return albums;
    }

    try {
      return mergeProviderCandidates(albums, await searchNeteaseArtistAlbums(input));
    } catch {
      return albums;
    }
  },
  async getAlbum(input) {
    const url = new URL(`https://music.163.com/api/v1/album/${encodeURIComponent(input.providerId)}`);
    const payload = await fetchJson(url, { referer: "https://music.163.com/" });
    const root = readRecord(payload);
    if (readNumber(root["code"]) !== 200) {
      return null;
    }
    const album = root["album"];
    const songs = asArray(root["songs"]).map(mapNeteaseTrack).filter(isDefined);
    return mapNeteaseAlbum(album, 0, songs);
  },
};

async function searchNeteaseAlbums(input: CatalogSearchInput): Promise<CatalogAlbumCandidate[]> {
    const url = new URL("https://music.163.com/api/search/get/web");
    url.searchParams.set("csrf_token", "");
    url.searchParams.set("s", providerSearchTerm(input));
    url.searchParams.set("type", "10");
    url.searchParams.set("offset", "0");
    url.searchParams.set("limit", String(input.limit));

    const payload = await fetchJson(url, { referer: "https://music.163.com/" });
    const result = readRecord(readRecord(payload)["result"]);
    const albums = asArray(result["albums"]);
    return albums.map((album, index) => mapNeteaseAlbum(album, index, []));
}

async function searchNeteaseArtistAlbums(input: CatalogSearchInput): Promise<CatalogAlbumCandidate[]> {
  const artistIds = await searchNeteaseArtistIds(input);
  const results = await Promise.all(
    artistIds.map(async (artistId) => {
      const url = new URL(`https://music.163.com/api/artist/albums/${encodeURIComponent(artistId)}`);
      url.searchParams.set("offset", "0");
      url.searchParams.set("limit", String(input.limit));

      const payload = await fetchJson(url, { referer: "https://music.163.com/" });
      const albums = asArray(readRecord(payload)["hotAlbums"]);
      return albums.map((album, index) => mapNeteaseAlbum(album, index, []));
    }),
  );
  return results.flat();
}

async function searchNeteaseArtistIds(input: CatalogSearchInput): Promise<string[]> {
  const target = normalizeText(input.artist ?? input.query);
  const url = new URL("https://music.163.com/api/search/get/web");
  url.searchParams.set("csrf_token", "");
  url.searchParams.set("s", input.artist ?? input.query);
  url.searchParams.set("type", "100");
  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", "5");

  const payload = await fetchJson(url, { referer: "https://music.163.com/" });
  const result = readRecord(readRecord(payload)["result"]);
  const artists = asArray(result["artists"]).map(readRecord);
  return artists
    .filter((artist) => {
      const name = readString(artist["name"]);
      if (!name) {
        return false;
      }
      const normalizedName = normalizeText(name);
      return normalizedName === target || normalizedName.includes(target) || target.includes(normalizedName);
    })
    .map((artist) => String(readNumber(artist["id"]) ?? readString(artist["id"]) ?? ""))
    .filter(Boolean)
    .slice(0, 2);
}

const qqMusicProvider: ProviderClient = {
  provider: "QQMUSIC",
  isEnabled: (input) => input.includeUnofficial,
  async search(input) {
    const url = new URL("https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg");
    url.searchParams.set("key", providerSearchTerm(input));
    url.searchParams.set("format", "json");
    url.searchParams.set("inCharset", "utf8");
    url.searchParams.set("outCharset", "utf-8");

    const payload = await fetchJson(url, { referer: "https://y.qq.com/" });
    const albums = asArray(readRecord(readRecord(readRecord(payload)["data"])["album"])["itemlist"]);
    return albums.map((album, index) => mapQQMusicAlbumSuggestion(album, index));
  },
  async getAlbum(input) {
    const url = new URL("https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg");
    url.searchParams.set("albummid", input.providerId);
    url.searchParams.set("format", "json");
    url.searchParams.set("platform", "yqq");
    url.searchParams.set("g_tk", "5381");
    url.searchParams.set("loginUin", "0");
    url.searchParams.set("hostUin", "0");
    url.searchParams.set("inCharset", "utf8");
    url.searchParams.set("outCharset", "utf-8");
    url.searchParams.set("notice", "0");
    url.searchParams.set("needNewCode", "0");

    const payload = await fetchJson(url, { referer: "https://y.qq.com/" });
    const root = readRecord(payload);
    if (readNumber(root["code"]) !== 0) {
      return null;
    }
    return mapQQMusicAlbumDetail(readRecord(root["data"]));
  },
};

const discogsProvider: ProviderClient = {
  provider: "DISCOGS",
  isEnabled: (_input, context) => Boolean(context.discogsToken),
  async search(input, context) {
    const url = new URL("https://api.discogs.com/database/search");
    url.searchParams.set("type", "release");
    url.searchParams.set("q", providerSearchTerm(input));
    url.searchParams.set("per_page", String(input.limit));
    if (context.discogsToken) {
      url.searchParams.set("token", context.discogsToken);
    }

    const payload = await fetchJson(url, { userAgent: context.userAgent });
    const results = asArray(readRecord(payload)["results"]);
    return results.map((result, index) => mapDiscogsSearchResult(result, index));
  },
  async getAlbum(input, context) {
    const url = new URL(`https://api.discogs.com/releases/${encodeURIComponent(input.providerId)}`);
    if (context.discogsToken) {
      url.searchParams.set("token", context.discogsToken);
    }

    const payload = await fetchJson(url, { userAgent: context.userAgent });
    return mapDiscogsRelease(payload, 0);
  },
};

async function fetchJson(
  url: URL,
  options: { userAgent?: string; referer?: string } = {},
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": options.userAgent ?? createProviderContext().userAgent,
  };
  if (options.referer) {
    headers.Referer = options.referer;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) {
    throw new Error(`Provider request failed: ${response.status}`);
  }
  return response.json();
}

function mapMusicBrainzRelease(value: unknown, index: number): CatalogAlbumCandidate | null {
  const release = readRecord(value);
  const id = readString(release["id"]);
  const title = readString(release["title"]);
  if (!id || !title) {
    return null;
  }

  const date = readString(release["date"]);
  const labelInfo = asArray(release["label-info"]).map(readRecord);
  const firstLabel = labelInfo.map((item) => readString(readRecord(item["label"])["name"])).find(isDefined);
  const media = asArray(release["media"]).map(readRecord);
  const tracks = media.flatMap((medium) =>
    asArray(medium["tracks"])
      .map(readRecord)
      .map((track, trackIndex): CatalogAlbumTrack | null => {
        const trackTitle = readString(track["title"]);
        if (!trackTitle) {
          return null;
        }
        return {
          position: readTrackPosition(track["position"]) ?? trackIndex + 1,
          title: trackTitle,
          durationMs: readNumber(track["length"]),
        };
      })
      .filter(isDefined),
  );

  return {
    id: `musicbrainz:${id}`,
    provider: "MUSICBRAINZ",
    providerId: id,
    title,
    artist: readMusicBrainzArtistCredit(release["artist-credit"]) ?? "",
    year: readYear(date),
    releaseDate: date,
    region: readString(release["country"]),
    label: firstLabel ?? null,
    genre: null,
    style: readString(readRecord(release["release-group"])["primary-type"]),
    format: media.map((medium) => readString(medium["format"])).find(isDefined) ?? null,
    barcode: readString(release["barcode"]),
    coverUrl: `https://coverartarchive.org/release/${id}/front-1200`,
    coverThumbUrl: `https://coverartarchive.org/release/${id}/front-250`,
    trackCount: readNumber(release["track-count"]) ?? (tracks.length || null),
    tracks,
    externalUrl: `https://musicbrainz.org/release/${id}`,
    score: clampScore(Math.min(readNumber(release["score"]) ?? 84, 86), index),
    providerRefs: [
      { provider: "MUSICBRAINZ", id, url: `https://musicbrainz.org/release/${id}` },
    ],
  };
}

function mapITunesCollection(
  value: unknown,
  index: number,
  tracks: CatalogAlbumTrack[],
): CatalogAlbumCandidate {
  const collection = readRecord(value);
  const providerId = String(readNumber(collection["collectionId"]) ?? readString(collection["collectionId"]) ?? "");
  const artwork = readString(collection["artworkUrl100"]);

  return {
    id: `itunes:${providerId}`,
    provider: "ITUNES",
    providerId,
    title: readString(collection["collectionName"]) ?? "",
    artist: readString(collection["artistName"]) ?? "",
    year: readYear(readString(collection["releaseDate"])),
    releaseDate: readString(collection["releaseDate"]),
    region: readString(collection["country"]),
    label: null,
    genre: readString(collection["primaryGenreName"]),
    style: null,
    format: "Digital",
    barcode: null,
    coverUrl: upgradeITunesArtwork(artwork, 1200),
    coverThumbUrl: upgradeITunesArtwork(artwork, 300),
    trackCount: readNumber(collection["trackCount"]) ?? (tracks.length || null),
    tracks,
    externalUrl: readString(collection["collectionViewUrl"]),
    score: clampScore(88, index),
    providerRefs: [
      { provider: "ITUNES", id: providerId, url: readString(collection["collectionViewUrl"]) },
    ],
  };
}

function mapITunesTrack(value: unknown): CatalogAlbumTrack | null {
  const track = readRecord(value);
  const title = readString(track["trackName"]);
  if (!title) {
    return null;
  }
  return {
    position: readNumber(track["trackNumber"]) ?? 1,
    title,
    durationMs: readNumber(track["trackTimeMillis"]),
  };
}

function mapNeteaseAlbum(
  value: unknown,
  index: number,
  tracks: CatalogAlbumTrack[],
): CatalogAlbumCandidate {
  const album = readRecord(value);
  const id = String(readNumber(album["id"]) ?? readString(album["idStr"]) ?? readString(album["id"]) ?? "");
  const artist = readString(readRecord(album["artist"])["name"])
    ?? asArray(album["artists"]).map((item) => readString(readRecord(item)["name"])).filter(isDefined).join(" / ");
  const publishTime = readNumber(album["publishTime"]);
  const releaseDate = publishTime ? new Date(publishTime).toISOString().slice(0, 10) : null;
  const coverUrl = readString(album["picUrl"]) ?? readString(album["blurPicUrl"]);

  return {
    id: `netease:${id}`,
    provider: "NETEASE",
    providerId: id,
    title: readString(album["name"]) ?? "",
    artist,
    year: readYear(releaseDate),
    releaseDate,
    region: "CN",
    label: readString(album["company"]),
    genre: readString(album["tags"]),
    style: readString(album["type"]) ?? readString(album["subType"]),
    format: null,
    barcode: null,
    coverUrl,
    coverThumbUrl: coverUrl,
    trackCount: readNumber(album["size"]) ?? (tracks.length || null),
    tracks,
    externalUrl: id ? `https://music.163.com/#/album?id=${id}` : null,
    score: clampScore(92, index),
    providerRefs: [
      { provider: "NETEASE", id, url: id ? `https://music.163.com/#/album?id=${id}` : null },
    ],
  };
}

function mapNeteaseTrack(value: unknown, index: number): CatalogAlbumTrack | null {
  const track = readRecord(value);
  const title = readString(track["name"]);
  if (!title) {
    return null;
  }
  return {
    position: readNumber(track["no"]) ?? readNumber(track["position"]) ?? index + 1,
    title,
    durationMs: readNumber(track["dt"]) ?? readNumber(track["duration"]),
  };
}

function mapQQMusicAlbumSuggestion(value: unknown, index: number): CatalogAlbumCandidate {
  const album = readRecord(value);
  const mid = readString(album["mid"]) ?? readString(album["id"]) ?? "";
  const coverThumb = normalizeHttps(readString(album["pic"]));
  const cover = coverThumb?.replace("T002R180x180", "T002R800x800") ?? coverThumb;

  return {
    id: `qqmusic:${mid}`,
    provider: "QQMUSIC",
    providerId: mid,
    title: readString(album["name"]) ?? "",
    artist: readString(album["singer"]) ?? "",
    year: null,
    releaseDate: null,
    region: "CN",
    label: null,
    genre: null,
    style: null,
    format: null,
    barcode: null,
    coverUrl: cover,
    coverThumbUrl: coverThumb,
    trackCount: null,
    tracks: [],
    externalUrl: mid ? `https://y.qq.com/n/ryqq/albumDetail/${mid}` : null,
    score: clampScore(91, index),
    providerRefs: [
      { provider: "QQMUSIC", id: mid, url: mid ? `https://y.qq.com/n/ryqq/albumDetail/${mid}` : null },
    ],
  };
}

function mapQQMusicAlbumDetail(album: Record<string, unknown>): CatalogAlbumCandidate {
  const mid = readString(album["mid"]) ?? "";
  const tracks = asArray(album["list"])
    .map(readRecord)
    .map((track, index): CatalogAlbumTrack | null => {
      const title = readString(track["songname"]) ?? readString(track["songorig"]);
      if (!title) {
        return null;
      }
      const seconds = readNumber(track["interval"]);
      return {
        position: readNumber(track["belongCD"]) ?? index + 1,
        title,
        durationMs: seconds === null ? null : seconds * 1000,
      };
    })
    .filter(isDefined);
  const cover = mid ? `https://y.gtimg.cn/music/photo_new/T002R800x800M000${mid}.jpg` : null;

  return {
    id: `qqmusic:${mid}`,
    provider: "QQMUSIC",
    providerId: mid,
    title: readString(album["name"]) ?? "",
    artist: readString(album["singername"]) ?? "",
    year: readYear(readString(album["aDate"])),
    releaseDate: readString(album["aDate"]),
    region: "CN",
    label: readString(album["company"]),
    genre: readString(album["genre"]),
    style: readString(album["lan"]),
    format: null,
    barcode: null,
    coverUrl: cover,
    coverThumbUrl: mid ? `https://y.gtimg.cn/music/photo_new/T002R180x180M000${mid}.jpg` : null,
    trackCount: readNumber(album["total_song_num"]) ?? readNumber(album["total"]) ?? (tracks.length || null),
    tracks,
    externalUrl: mid ? `https://y.qq.com/n/ryqq/albumDetail/${mid}` : null,
    score: 98,
    providerRefs: [
      { provider: "QQMUSIC", id: mid, url: mid ? `https://y.qq.com/n/ryqq/albumDetail/${mid}` : null },
    ],
  };
}

function mapDiscogsSearchResult(value: unknown, index: number): CatalogAlbumCandidate {
  const result = readRecord(value);
  const id = String(readNumber(result["id"]) ?? readString(result["id"]) ?? "");
  const splitTitle = splitDiscogsTitle(readString(result["title"]) ?? "");
  const cover = readString(result["cover_image"]) ?? readString(result["thumb"]);

  return {
    id: `discogs:${id}`,
    provider: "DISCOGS",
    providerId: id,
    title: splitTitle.title,
    artist: splitTitle.artist,
    year: readNumber(result["year"]),
    releaseDate: readNumber(result["year"]) === null ? null : String(readNumber(result["year"])),
    region: readString(result["country"]),
    label: asArray(result["label"]).map(readString).find(isDefined) ?? null,
    genre: asArray(result["genre"]).map(readString).find(isDefined) ?? null,
    style: asArray(result["style"]).map(readString).join(" / ") || null,
    format: asArray(result["format"]).map(readString).join(" / ") || null,
    barcode: null,
    coverUrl: cover,
    coverThumbUrl: readString(result["thumb"]) ?? cover,
    trackCount: null,
    tracks: [],
    externalUrl: readString(result["uri"]),
    score: clampScore(90, index),
    providerRefs: [{ provider: "DISCOGS", id, url: readString(result["uri"]) }],
  };
}

function mapDiscogsRelease(value: unknown, index: number): CatalogAlbumCandidate {
  const release = readRecord(value);
  const id = String(readNumber(release["id"]) ?? readString(release["id"]) ?? "");
  const artists = asArray(release["artists"]).map((artist) => readString(readRecord(artist)["name"])).filter(isDefined);
  const labels = asArray(release["labels"]).map((label) => readString(readRecord(label)["name"])).filter(isDefined);
  const images = asArray(release["images"]).map(readRecord);
  const cover = images.map((image) => readString(image["uri"]) ?? readString(image["resource_url"])).find(isDefined);
  const tracks = asArray(release["tracklist"])
    .map(readRecord)
    .map((track, trackIndex): CatalogAlbumTrack | null => {
      const title = readString(track["title"]);
      if (!title) {
        return null;
      }
      return {
        position: readTrackPosition(track["position"]) ?? trackIndex + 1,
        title,
        durationMs: null,
      };
    })
    .filter(isDefined);

  return {
    id: `discogs:${id}`,
    provider: "DISCOGS",
    providerId: id,
    title: readString(release["title"]) ?? "",
    artist: artists.join(" / "),
    year: readNumber(release["year"]),
    releaseDate: readNumber(release["year"]) === null ? null : String(readNumber(release["year"])),
    region: readString(release["country"]),
    label: labels[0] ?? null,
    genre: asArray(release["genres"]).map(readString).find(isDefined) ?? null,
    style: asArray(release["styles"]).map(readString).join(" / ") || null,
    format: asArray(release["formats"]).map((format) => readString(readRecord(format)["name"])).filter(isDefined).join(" / ") || null,
    barcode: readDiscogsBarcode(release["identifiers"]),
    coverUrl: cover ?? null,
    coverThumbUrl: images.map((image) => readString(image["uri150"])).find(isDefined) ?? cover ?? null,
    trackCount: tracks.length || null,
    tracks,
    externalUrl: readString(release["uri"]),
    score: clampScore(95, index),
    providerRefs: [{ provider: "DISCOGS", id, url: readString(release["uri"]) }],
  };
}

function createProviderContext(): ProviderContext {
  return {
    userAgent:
      process.env["CATALOG_USER_AGENT"]
      ?? "VinylCabinet/0.1.0 (configure CATALOG_USER_AGENT)",
    discogsToken: process.env["DISCOGS_TOKEN"]?.trim() || null,
  };
}

function rankAndDedupe(
  candidates: CatalogAlbumCandidate[],
  input: CatalogSearchInput,
): CatalogAlbumCandidate[] {
  const seen = new Set<string>();
  return candidates
    .map((candidate) => ({
      candidate,
      score: candidate.score + scoreText(candidate, input),
    }))
    .sort((left, right) => right.score - left.score)
    .map(({ candidate, score }) => ({ ...candidate, score: Math.min(100, Math.round(score)) }))
    .filter((candidate) => {
      const key = [
        normalizeText(candidate.title),
        normalizeText(candidate.artist),
        candidate.year ?? "",
      ].join("|");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function mergeProviderCandidates(
  primary: CatalogAlbumCandidate[],
  supplemental: CatalogAlbumCandidate[],
): CatalogAlbumCandidate[] {
  const seen = new Set<string>();
  const result: CatalogAlbumCandidate[] = [];
  for (const candidate of [...primary, ...supplemental]) {
    const key = `${candidate.provider}:${candidate.providerId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

function scoreText(candidate: CatalogAlbumCandidate, input: CatalogSearchInput): number {
  let score = 0;
  const title = normalizeText(candidate.title);
  const query = normalizeText(input.query);
  if (title === query) {
    score += 8;
  } else if (title.includes(query)) {
    score += 3;
  }
  if (input.artist) {
    const artist = normalizeText(candidate.artist);
    const wantedArtist = normalizeText(input.artist);
    if (artist === wantedArtist) {
      score += 6;
    } else if (artist.includes(wantedArtist)) {
      score += 2;
    }
  }
  if (candidate.coverUrl) {
    score += 2;
  }
  if (candidate.tracks.length > 0) {
    score += 2;
  }
  return score;
}

function escapeMusicBrainzQuery(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function buildMusicBrainzSearchQuery(input: CatalogSearchInput): string {
  if (isArtistOnlySearch(input)) {
    return `artist:"${escapeMusicBrainzQuery(input.artist ?? input.query)}"`;
  }
  if (input.artist) {
    return `release:"${escapeMusicBrainzQuery(input.query)}" AND artist:"${escapeMusicBrainzQuery(input.artist)}"`;
  }
  return escapeMusicBrainzQuery(input.query);
}

function providerSearchTerm(input: CatalogSearchInput): string {
  if (isArtistOnlySearch(input)) {
    return input.artist ?? input.query;
  }
  return [input.query, input.artist].filter(isDefined).join(" ");
}

function isArtistOnlySearch(input: CatalogSearchInput): boolean {
  return Boolean(input.artist && normalizeText(input.artist) === normalizeText(input.query));
}

function readMusicBrainzArtistCredit(value: unknown): string | null {
  const artists = asArray(value)
    .map((item) => readString(readRecord(item)["name"]))
    .filter(isDefined);
  return artists.length > 0 ? artists.join("") : null;
}

function upgradeITunesArtwork(url: string | null, size: number): string | null {
  if (!url) {
    return null;
  }
  return url.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/u, `/${size}x${size}bb.$1`);
}

function normalizeHttps(value: string | null): string | null {
  return value?.replace(/^http:/u, "https:") ?? null;
}

function readDiscogsBarcode(value: unknown): string | null {
  const barcode = asArray(value)
    .map(readRecord)
    .find((identifier) => readString(identifier["type"])?.toLowerCase() === "barcode");
  return readString(barcode?.["value"]);
}

function splitDiscogsTitle(value: string): { artist: string; title: string } {
  const separator = value.indexOf(" - ");
  if (separator === -1) {
    return { artist: "", title: value };
  }
  return {
    artist: value.slice(0, separator),
    title: value.slice(separator + 3),
  };
}

function clampScore(score: number, index: number): number {
  return Math.max(1, Math.min(100, Math.round(score - index * 3)));
}

function readYear(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const match = /^\d{4}/u.exec(value);
  return match ? Number(match[0]) : null;
}

function readTrackPosition(value: unknown): number | null {
  const text = readString(value);
  if (!text) {
    return null;
  }
  const match = /\d+/u.exec(text);
  return match ? Number(match[0]) : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, " ").trim();
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
