import { describe, expect, it } from "vitest";

import { getDatabaseUrl } from "./database.config.js";

describe("getDatabaseUrl", () => {
  it("accepts a PostgreSQL connection string", () => {
    expect(
      getDatabaseUrl({
        DATABASE_URL: "postgresql://vinyl:vinyl@127.0.0.1:5432/vinyl",
      }),
    ).toBe("postgresql://vinyl:vinyl@127.0.0.1:5432/vinyl");
  });

  it("accepts the postgres protocol used by hosted providers", () => {
    expect(getDatabaseUrl({ DATABASE_URL: "postgres://localhost/vinyl" })).toBe(
      "postgres://localhost/vinyl",
    );
  });

  it("rejects a missing database connection string", () => {
    expect(() => getDatabaseUrl({})).toThrow("DATABASE_URL is required");
  });

  it("rejects a non-PostgreSQL connection string", () => {
    expect(() => getDatabaseUrl({ DATABASE_URL: "mysql://localhost/vinyl" })).toThrow(
      "DATABASE_URL must use a PostgreSQL protocol",
    );
  });
});
