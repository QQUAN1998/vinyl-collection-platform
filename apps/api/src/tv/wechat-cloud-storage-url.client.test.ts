import { afterEach, describe, expect, it, vi } from "vitest";

import { WechatApiCloudStorageUrlClient } from "./wechat-cloud-storage-url.client.js";

describe("WechatApiCloudStorageUrlClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["WECHAT_APP_ID"];
    delete process.env["WECHAT_APP_SECRET"];
    delete process.env["WECHAT_CLOUD_ENV"];
  });

  it("exchanges cloud file IDs for HTTPS download URLs", async () => {
    process.env["WECHAT_APP_ID"] = "app-id";
    process.env["WECHAT_APP_SECRET"] = "app-secret";
    process.env["WECHAT_CLOUD_ENV"] = "cloud-env";
    const cloudCover = "cloud://cloud-env.bucket/album-covers/custom.jpg";
    const httpsCover = "https://cdn.example.com/album-covers/custom.jpg";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token", expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errcode: 0,
          file_list: [{ fileid: cloudCover, download_url: httpsCover, status: 0 }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new WechatApiCloudStorageUrlClient().resolve([cloudCover, cloudCover]);

    expect(result.get(cloudCover)).toBe(httpsCover);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const batchRequest = fetchMock.mock.calls[1];
    expect(batchRequest?.[0]).toContain("/tcb/batchdownloadfile?access_token=access-token");
    expect(JSON.parse(String(batchRequest?.[1]?.body))).toEqual({
      env: "cloud-env",
      file_list: [{ fileid: cloudCover, max_age: 7200 }],
    });

    await expect(new WechatApiCloudStorageUrlClient().resolve([])).resolves.toEqual(new Map());
    const cachedResult = await clientResult(cloudCover, fetchMock, cloudCover, httpsCover);
    expect(cachedResult.get(cloudCover)).toBe(httpsCover);
  });
});

async function clientResult(
  fileId: string,
  fetchMock: ReturnType<typeof vi.fn>,
  expectedFileId: string,
  expectedUrl: string,
) {
  const client = new WechatApiCloudStorageUrlClient();
  fetchMock.mockClear();
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "access-token", expires_in: 7200 }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        errcode: 0,
        file_list: [{ fileid: expectedFileId, download_url: expectedUrl, status: 0 }],
      }),
    });
  const first = await client.resolve([fileId]);
  const second = await client.resolve([fileId]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(second).toEqual(first);
  return second;
}
