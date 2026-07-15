import { UnauthorizedException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createWechatApiSessionClientForTest } from "./wechat-session.client.js";

describe("WechatApiSessionClient", () => {
  beforeEach(() => {
    process.env["WECHAT_APP_ID"] = "wx-test-app";
    process.env["WECHAT_APP_SECRET"] = "test-app-secret";
  });

  afterEach(() => {
    delete process.env["WECHAT_APP_ID"];
    delete process.env["WECHAT_APP_SECRET"];
  });

  it("exchanges a WeChat login code through the injected requester", async () => {
    let requestedUrl: URL | null = null;
    const client = createWechatApiSessionClientForTest(async (url) => {
      requestedUrl = url;
      return { openid: "openid-user-1", session_key: "session-key" };
    });

    await expect(client.exchangeCode("wx-login-code")).resolves.toEqual({
      openId: "openid-user-1",
    });
    expect(requestedUrl?.hostname).toBe("api.weixin.qq.com");
    expect(requestedUrl?.searchParams.get("appid")).toBe("wx-test-app");
    expect(requestedUrl?.searchParams.get("js_code")).toBe("wx-login-code");
    expect(requestedUrl?.searchParams.get("grant_type")).toBe("authorization_code");
  });

  it("rejects WeChat error responses as unauthenticated login attempts", async () => {
    const client = createWechatApiSessionClientForTest(async () => ({
      errcode: 40029,
      errmsg: "invalid code",
    }));

    await expect(client.exchangeCode("bad-code")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
