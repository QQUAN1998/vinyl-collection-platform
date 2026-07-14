import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogService } from "./catalog.service.js";

const originalFetch = globalThis.fetch;

describe("CatalogService", () => {
  beforeEach(() => {
    process.env["CATALOG_USER_AGENT"] = "VinylCabinetTest/0.1.0 (test@example.com)";
    delete process.env["DISCOGS_TOKEN"];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("aggregates album candidates from enabled providers", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://musicbrainz.org/ws/2/release/")) {
        return jsonResponse({
          releases: [
            {
              id: "mb-release-1",
              title: "Kind of Blue",
              "artist-credit": [{ name: "Miles Davis" }],
              date: "1959-08-17",
              country: "US",
              "track-count": 5,
              score: 100,
              "release-group": { "primary-type": "Album" },
              media: [{ format: "Vinyl" }],
            },
          ],
        });
      }
      if (url.startsWith("https://itunes.apple.com/search")) {
        return jsonResponse({
          resultCount: 1,
          results: [
            {
              wrapperType: "collection",
              collectionId: 268443092,
              collectionName: "Kind of Blue (Apple)",
              artistName: "Miles Davis",
              releaseDate: "1959-08-17T07:00:00Z",
              country: "USA",
              primaryGenreName: "Jazz",
              trackCount: 5,
              artworkUrl100: "https://example.com/100x100bb.jpg",
              collectionViewUrl: "https://music.apple.com/album/268443092",
            },
          ],
        });
      }
      if (url.startsWith("https://music.163.com/api/search/get/web")) {
        return jsonResponse({
          code: 200,
          result: {
            albums: [
              {
                id: 18915,
                name: "范特西",
                type: "专辑",
                size: 10,
                picUrl: "https://p2.music.126.net/fantasy.jpg",
                publishTime: 1000396800000,
                company: "杰威尔",
                artist: { name: "周杰伦" },
              },
            ],
          },
        });
      }
      if (url.startsWith("https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg")) {
        return jsonResponse({
          code: 0,
          data: {
            album: {
              itemlist: [
                {
                  id: "8217",
                  mid: "000I5jJB3blWeN",
                  name: "范特西",
                  singer: "周杰伦",
                  pic: "http://y.gtimg.cn/music/photo_new/T002R180x180M000000I5jJB3blWeN_3.jpg",
                },
              ],
            },
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const service = new CatalogService();
    const response = await service.search({
      query: "Kind of Blue",
      artist: "Miles Davis",
      limit: 8,
      country: "US",
      includeUnofficial: true,
    });

    expect(response.providers.enabled).toEqual(["MUSICBRAINZ", "ITUNES", "NETEASE", "QQMUSIC"]);
    expect(response.providers.failed).toEqual([]);
    expect(response.data.map((item) => item.provider)).toContain("MUSICBRAINZ");
    expect(response.data.map((item) => item.provider)).toContain("ITUNES");
    expect(response.data.map((item) => item.provider)).toContain("NETEASE");
    expect(response.data.map((item) => item.provider)).toContain("QQMUSIC");
    expect(response.data.find((item) => item.provider === "MUSICBRAINZ")?.coverThumbUrl)
      .toBe("https://coverartarchive.org/release/mb-release-1/front-250");
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("api.discogs.com"), expect.anything());
  });

  it("loads Netease album details with tracks", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (!url.startsWith("https://music.163.com/api/v1/album/18915")) {
        throw new Error(`Unexpected URL: ${url}`);
      }
      return jsonResponse({
        code: 200,
        album: {
          id: 18915,
          name: "范特西",
          type: "专辑",
          size: 2,
          picUrl: "https://p2.music.126.net/fantasy.jpg",
          publishTime: 1000396800000,
          company: "杰威尔",
          artist: { name: "周杰伦" },
        },
        songs: [
          { no: 1, name: "爱在西元前", dt: 234253 },
          { no: 2, name: "爸，我回来了", dt: 235000 },
        ],
      });
    }) as unknown as typeof fetch;

    const service = new CatalogService();
    const album = await service.getAlbum({
      provider: "NETEASE",
      providerId: "18915",
      country: "CN",
      includeUnofficial: true,
    });

    expect(album?.title).toBe("范特西");
    expect(album?.artist).toBe("周杰伦");
    expect(album?.tracks).toEqual([
      { position: 1, title: "爱在西元前", durationMs: 234253 },
      { position: 2, title: "爸，我回来了", durationMs: 235000 },
    ]);
  });

  it("skips Discogs unless a token is configured", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const service = new CatalogService();
    const album = await service.getAlbum({
      provider: "DISCOGS",
      providerId: "123",
      country: "US",
      includeUnofficial: true,
    });

    expect(album).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("loads QQ Music album details with tracks", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (!url.startsWith("https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg")) {
        throw new Error(`Unexpected URL: ${url}`);
      }
      return jsonResponse({
        code: 0,
        data: {
          aDate: "2001-09-14",
          company: "杰威尔音乐有限公司",
          genre: "R&B 节奏布鲁斯",
          lan: "国语",
          mid: "000I5jJB3blWeN",
          name: "范特西",
          singername: "周杰伦",
          total_song_num: 2,
          list: [
            { belongCD: 1, songname: "爱在西元前", interval: 234 },
            { belongCD: 2, songname: "爸，我回来了", interval: 235 },
          ],
        },
      });
    }) as unknown as typeof fetch;

    const service = new CatalogService();
    const album = await service.getAlbum({
      provider: "QQMUSIC",
      providerId: "000I5jJB3blWeN",
      country: "CN",
      includeUnofficial: true,
    });

    expect(album?.title).toBe("范特西");
    expect(album?.genre).toBe("R&B 节奏布鲁斯");
    expect(album?.tracks).toEqual([
      { position: 1, title: "爱在西元前", durationMs: 234000 },
      { position: 2, title: "爸，我回来了", durationMs: 235000 },
    ]);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
