import { describe, expect, it } from "vitest";

import {
  FREE_COLLECTION_LIMIT,
  VIP_COLLECTION_LIMIT,
  getFoundingMemberExpiry,
  getCollectionAccess,
} from "./membership-policy.js";

describe("getCollectionAccess", () => {
  const now = new Date("2026-07-11T00:00:00.000Z");

  it("limits a free account to 10 collection records", () => {
    const access = getCollectionAccess({ membershipExpiresAt: null, now });

    expect(access).toEqual({ isVip: false, collectionLimit: FREE_COLLECTION_LIMIT });
    expect(FREE_COLLECTION_LIMIT).toBe(10);
  });

  it("allows an active VIP account up to 10,000 collection records", () => {
    const access = getCollectionAccess({
      membershipExpiresAt: new Date("2027-07-11T00:00:00.000Z"),
      now,
    });

    expect(access).toEqual({ isVip: true, collectionLimit: VIP_COLLECTION_LIMIT });
    expect(VIP_COLLECTION_LIMIT).toBe(10_000);
  });

  it("treats an expired membership as free on both clients", () => {
    const access = getCollectionAccess({
      membershipExpiresAt: new Date("2026-07-10T23:59:59.999Z"),
      now,
    });

    expect(access.isVip).toBe(false);
    expect(access.collectionLimit).toBe(10);
  });

  it("treats the exact expiry instant as expired", () => {
    const access = getCollectionAccess({ membershipExpiresAt: now, now });

    expect(access.isVip).toBe(false);
  });
});

describe("getFoundingMemberExpiry", () => {
  const registeredAt = new Date("2026-07-11T08:00:00.000Z");

  it.each([1, 10])("gives registration number %i one year of VIP", (registrationSequence) => {
    const expiresAt = getFoundingMemberExpiry({ registrationSequence, registeredAt });

    expect(expiresAt).toEqual(new Date("2027-07-11T08:00:00.000Z"));
  });

  it("does not give the founding benefit to registration number 11", () => {
    const expiresAt = getFoundingMemberExpiry({ registrationSequence: 11, registeredAt });

    expect(expiresAt).toBeNull();
  });

  it("preserves calendar semantics for a leap-day registration", () => {
    const expiresAt = getFoundingMemberExpiry({
      registrationSequence: 3,
      registeredAt: new Date("2024-02-29T08:00:00.000Z"),
    });

    expect(expiresAt).toEqual(new Date("2025-02-28T08:00:00.000Z"));
  });
});
