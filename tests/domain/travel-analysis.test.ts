import { describe, expect, it } from "vitest";

import type { RequesterType, TravelRequestInput } from "../../src/main";
import { analyzeTravelRequest } from "../../src/domain/travel-analysis";

function makeInput(
  overrides: Partial<TravelRequestInput> = {},
): TravelRequestInput {
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

describe("analyzeTravelRequest", () => {
  it("approves a regular request and computes the amounts", () => {
    const analysis = analyzeTravelRequest(makeInput());

    expect(analysis).toEqual({
      status: "approved",
      travelDays: 3,
      dailyAmountInCents: 18000,
      subtotalInCents: 54000,
      totalAmountInCents: 66000,
      errors: [],
      warnings: [],
    });
  });

  it("rejects invalid requests but still computes zeroed amounts", () => {
    const analysis = analyzeTravelRequest(
      makeInput({ requestId: "", departureDate: "2026/08/10" }),
    );

    expect(analysis.status).toBe("rejected");
    expect(analysis.travelDays).toBe(0);
    expect(analysis.subtotalInCents).toBe(0);
    expect(analysis.totalAmountInCents).toBe(12000);
    expect(analysis.errors).toEqual([
      "requestId is required",
      "departureDate must be a valid YYYY-MM-DD date",
    ]);
  });

  it("keeps an unknown requester type without daily amount", () => {
    const analysis = analyzeTravelRequest(
      makeInput({ requesterType: "" as RequesterType }),
    );

    expect(analysis.dailyAmountInCents).toBe(0);
    expect(analysis.subtotalInCents).toBe(0);
    expect(analysis.errors).toEqual(["requesterType is required"]);
  });

  it("marks long travels as pending-review", () => {
    const analysis = analyzeTravelRequest(
      makeInput({
        departureDate: "2026-08-10",
        returnDate: "2026-08-20",
        reason: "Attend the full institutional strategic planning week",
      }),
    );

    expect(analysis.travelDays).toBe(11);
    expect(analysis.status).toBe("pending-review");
    expect(analysis.warnings).toEqual([]);
  });

  it("warns when a long travel has a short reason", () => {
    const analysis = analyzeTravelRequest(
      makeInput({
        departureDate: "2026-08-10",
        returnDate: "2026-08-20",
        reason: "short",
      }),
    );

    expect(analysis.status).toBe("pending-review");
    expect(analysis.warnings).toEqual([
      "long travel requests should include a detailed reason",
    ]);
  });

  it("marks high-value travels as pending-review", () => {
    const analysis = analyzeTravelRequest(
      makeInput({
        requesterType: "manager",
        departureDate: "2026-08-10",
        returnDate: "2026-08-14",
        transportCostInCents: 90000,
      }),
    );

    expect(analysis.travelDays).toBe(5);
    expect(analysis.totalAmountInCents).toBe(240000);
    expect(analysis.status).toBe("pending-review");
  });

  it("rejects requests when returnDate is before departureDate", () => {
    const analysis = analyzeTravelRequest(
      makeInput({
        departureDate: "2026-08-15",
        returnDate: "2026-08-14",
      }),
    );

    expect(analysis.travelDays).toBe(0);
    expect(analysis.status).toBe("rejected");
    expect(analysis.errors).toEqual(["returnDate cannot be before departureDate"]);
  });
});
