import { describe, expect, it } from "vitest";

import type { RequesterType, TravelRequestInput } from "../../src/main";
import { validateTravelRequest } from "../../src/domain/travel-validator";

function makeInput(overrides: Partial<TravelRequestInput> = {}): TravelRequestInput {
  return {
    requestId: "TR-001",
    requesterName: "Ada Lovelace",
    requesterType: "employee",
    destination: "Teresina",
    departureDate: "2026-08-10",
    returnDate: "2026-08-12",
    reason: "Attend institutional technical meeting",
    transportCostInCents: 12000,
    ...overrides,
  };
}

describe("validateTravelRequest", () => {
  it("returns no errors for a valid travel request", () => {
    expect(validateTravelRequest(makeInput())).toEqual([]);
  });

  it("rejects requests with missing required fields", () => {
    const errors = validateTravelRequest(
      makeInput({
        requestId: "",
        requesterName: "",
        requesterType: "" as RequesterType,
        destination: "",
        departureDate: "",
        returnDate: "",
      }),
    );

    expect(errors).toEqual([
      "requestId is required",
      "requesterName is required",
      "requesterType is required",
      "destination is required",
      "departureDate is required",
      "returnDate is required",
    ]);
  });

  it("rejects requests with invalid date formats", () => {
    const errors = validateTravelRequest(
      makeInput({
        departureDate: "2026/08/10",
        returnDate: "2026-02-30",
      }),
    );

    expect(errors).toEqual([
      "departureDate must be a valid YYYY-MM-DD date",
      "returnDate must be a valid YYYY-MM-DD date",
    ]);
  });

  it("rejects requests when returnDate is before departureDate", () => {
    const errors = validateTravelRequest(
      makeInput({
        departureDate: "2026-08-15",
        returnDate: "2026-08-14",
      }),
    );

    expect(errors).toEqual(["returnDate cannot be before departureDate"]);
  });

  it("keeps validation errors in the legacy order", () => {
    const errors = validateTravelRequest(
      makeInput({
        requestId: "",
        departureDate: "2026/08/10",
        returnDate: "2026-08-14",
      }),
    );

    expect(errors[0]).toBe("requestId is required");
    expect(errors).toContain("departureDate must be a valid YYYY-MM-DD date");
    expect(errors.indexOf("requestId is required")).toBeLessThan(
      errors.indexOf("departureDate must be a valid YYYY-MM-DD date"),
    );
  });
});
