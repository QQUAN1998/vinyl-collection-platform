import { describe, expect, it } from "vitest";

import { getSystemInfo } from "./system-info.js";

describe("getSystemInfo", () => {
  it("returns the collection limits shared by all clients", () => {
    expect(getSystemInfo()).toEqual({
      collectionLimits: {
        free: 10,
        vip: 10_000,
      },
      foundingMemberCount: 10,
    });
  });
});
