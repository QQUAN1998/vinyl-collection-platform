import { describe, expect, it } from "vitest";

import { routeRequest } from "./router.js";

describe("routeRequest", () => {
  it("returns a health response", () => {
    expect(routeRequest("GET", "/health")).toEqual({
      status: 200,
      body: { status: "ok" },
    });
  });

  it("returns public collection policy information", () => {
    expect(routeRequest("GET", "/v1/system/info")).toEqual({
      status: 200,
      body: {
        collectionLimits: { free: 10, vip: 10_000 },
        foundingMemberCount: 10,
      },
    });
  });

  it("returns 404 for an unknown route", () => {
    expect(routeRequest("GET", "/missing")).toEqual({
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "Route not found",
        },
      },
    });
  });
});
