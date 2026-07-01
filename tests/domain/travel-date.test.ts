import { describe, expect, it } from "vitest";

import { isValidDate, toUtcTimestamp } from "../../src/domain/travel-date";

describe("isValidDate", () => {
  it("accepts valid YYYY-MM-DD dates", () => {
    expect(isValidDate("2026-08-10")).toBe(true);
    expect(isValidDate("2026-09-01")).toBe(true);
  });

  it("rejects invalid date formats", () => {
    expect(isValidDate("2026/08/10")).toBe(false);
    expect(isValidDate("08-10-2026")).toBe(false);
    expect(isValidDate("2026-8-10")).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
  });

  it("accepts same-day departure and return dates", () => {
    expect(isValidDate("2026-09-01")).toBe(true);
  });
});

describe("toUtcTimestamp", () => {
  it("converts dates to comparable UTC timestamps", () => {
    const earlier = toUtcTimestamp("2026-08-10");
    const later = toUtcTimestamp("2026-08-12");

    expect(later).toBeGreaterThan(earlier);
  });

  it("returns equal timestamps for the same date", () => {
    expect(toUtcTimestamp("2026-09-01")).toBe(toUtcTimestamp("2026-09-01"));
  });
});
