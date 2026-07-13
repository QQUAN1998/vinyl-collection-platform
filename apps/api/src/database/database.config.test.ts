import { describe, expect, it } from "vitest";

import { getDatabaseUrl } from "./database.config.js";

describe("getDatabaseUrl", () => {
  it("accepts a MySQL connection string", () => {
    expect(
      getDatabaseUrl({
        DATABASE_URL: "mysql://vinyl:vinyl@127.0.0.1:3306/vinyl",
      }),
    ).toBe("mysql://vinyl:vinyl@127.0.0.1:3306/vinyl");
  });

  it("accepts the mysql protocol used by hosted providers", () => {
    expect(
      getDatabaseUrl({
        DATABASE_URL: "mysql://root:secret@10.10.108.203:3306/vinyl_cabinet",
      }),
    ).toBe("mysql://root:secret@10.10.108.203:3306/vinyl_cabinet");
  });

  it("builds a MySQL connection string from WeChat Cloud Hosting variables", () => {
    expect(
      getDatabaseUrl({
        MYSQL_ADDRESS: "10.10.108.203:3306",
        MYSQL_USERNAME: "root",
        MYSQL_PASSWORD: "secret",
        MYSQL_DATABASE: "vinyl_cabinet",
      }),
    ).toBe("mysql://root:secret@10.10.108.203:3306/vinyl_cabinet");
  });

  it("defaults the WeChat Cloud Hosting database name", () => {
    expect(
      getDatabaseUrl({
        MYSQL_ADDRESS: "10.10.108.203:3306",
        MYSQL_USERNAME: "root",
        MYSQL_PASSWORD: "secret",
      }),
    ).toBe("mysql://root:secret@10.10.108.203:3306/vinyl_cabinet");
  });

  it("rejects a missing database connection string", () => {
    expect(() => getDatabaseUrl({})).toThrow("DATABASE_URL is required");
  });

  it("rejects a non-MySQL connection string", () => {
    expect(() =>
      getDatabaseUrl({ DATABASE_URL: "postgresql://localhost/vinyl" }),
    ).toThrow("DATABASE_URL must use a MySQL protocol");
  });
});
