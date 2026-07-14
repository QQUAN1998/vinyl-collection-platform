# Catalog API

The mini program should call our Cloud Hosting API instead of calling third-party music services directly. This keeps provider details, tokens, rate limits, and fallback logic on the server.

## Providers

- MusicBrainz + Cover Art Archive: open metadata and cover image URLs.
- Apple iTunes Search API: no key, strong cover fallback, good global catalog coverage.
- NetEase Cloud Music web API: unofficial fallback for Chinese albums, enabled by default through `includeUnofficial=true`.
- QQ Music web API: unofficial fallback for Chinese albums, including album details and track lists, enabled by default through `includeUnofficial=true`.
- Discogs: optional physical-release source, enabled only when `DISCOGS_TOKEN` is configured.

## Search

```http
GET /api/catalog/search?q=范特西&artist=周杰伦&limit=100&country=CN&includeUnofficial=true
```

Response shape:

```json
{
  "query": "范特西",
  "artist": "周杰伦",
  "providers": {
    "enabled": ["MUSICBRAINZ", "ITUNES", "NETEASE", "QQMUSIC"],
    "failed": []
  },
  "data": [
    {
      "id": "netease:18915",
      "provider": "NETEASE",
      "providerId": "18915",
      "title": "范特西",
      "artist": "周杰伦",
      "year": 2001,
      "releaseDate": "2001-09-14",
      "region": "CN",
      "label": "杰威尔",
      "genre": null,
      "style": "专辑",
      "format": null,
      "barcode": null,
      "coverUrl": "https://p2.music.126.net/...",
      "coverThumbUrl": "https://p2.music.126.net/...",
      "trackCount": 10,
      "tracks": [],
      "externalUrl": "https://music.163.com/#/album?id=18915",
      "score": 100,
      "providerRefs": [
        {
          "provider": "NETEASE",
          "id": "18915",
          "url": "https://music.163.com/#/album?id=18915"
        }
      ]
    }
  ]
}
```

## Album Detail

Use the selected candidate's `provider` and `providerId` to load a fuller record, including tracks when that provider exposes them.

```http
GET /api/catalog/albums/NETEASE/18915?country=CN&includeUnofficial=true
GET /api/catalog/albums/QQMUSIC/000I5jJB3blWeN?country=CN&includeUnofficial=true
GET /api/catalog/albums/ITUNES/268443092?country=US
GET /api/catalog/albums/MUSICBRAINZ/e32a3f0b-1c19-3170-bb1c-650893774744
```

## Environment

```env
CATALOG_USER_AGENT=VinylCabinet/0.1.0 (your-email@example.com)
DISCOGS_TOKEN=
```

Set `DISCOGS_TOKEN` only when you want Discogs enabled. Without it, Discogs is skipped and the API still works.

## Risk Note

NetEase and QQ Music are intentionally treated as unofficial providers. They improve hit rate for Chinese albums, but can break or be rate-limited without notice. Keep `includeUnofficial=false` available for stricter production mode.
