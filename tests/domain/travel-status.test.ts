import { describe, expect, it } from "vitest";

import { buildWarnings, determineStatus } from "../../src/domain/travel-status";

describe("determineStatus", () => {
  it("returns rejected when there are validation errors", () => {
    expect(determineStatus(["requestId is required"], 3, 50000)).toBe(
      "rejected",
    );
  });

  it("prioritizes rejected over review conditions", () => {
    expect(determineStatus(["requestId is required"], 10, 500000)).toBe(
      "rejected",
    );
  });

  it("returns pending-review for travels longer than five days", () => {
    expect(determineStatus([], 6, 50000)).toBe("pending-review");
  });

  it("returns pending-review when the total exceeds the threshold", () => {
    expect(determineStatus([], 3, 200001)).toBe("pending-review");
  });

  it("keeps approved when the total equals the threshold", () => {
    expect(determineStatus([], 3, 200000)).toBe("approved");
  });

  it("returns approved for a regular travel within limits", () => {
    expect(determineStatus([], 5, 150000)).toBe("approved");
  });
});

describe("buildWarnings", () => {
  it("warns when a long travel has a short reason", () => {
    expect(buildWarnings(6, "too short")).toEqual([
      "long travel requests should include a detailed reason",
    ]);
  });

  it("does not warn when a long travel has a detailed reason", () => {
    expect(
      buildWarnings(6, "Attend the annual institutional planning committee"),
    ).toEqual([]);
  });

  it("does not warn for short travels regardless of the reason", () => {
    expect(buildWarnings(5, "x")).toEqual([]);
  });
});
