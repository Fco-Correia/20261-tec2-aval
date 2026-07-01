import { describe, expect, it } from "vitest";

import {
  processTravelRequest,
  type RequesterType,
  type TravelRequestInput,
} from "../../src/main";

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

describe("processTravelRequest", () => {
  it("approves a simple valid travel request", () => {
    const output = processTravelRequest(makeInput());

    expect(output).toEqual({
      requestId: "TR-001",
      status: "approved",
      travelDays: 3,
      dailyAmountInCents: 18000,
      subtotalInCents: 54000,
      totalAmountInCents: 66000,
      errors: [],
      warnings: [],
    });
  });

  it("calculates travel days inclusively", () => {
    const output = processTravelRequest(
      makeInput({
        departureDate: "2026-09-01",
        returnDate: "2026-09-01",
      }),
    );

    expect(output.travelDays).toBe(1);
    expect(output.subtotalInCents).toBe(18000);
  });

  it("uses the configured daily amount for each requester type", () => {
    const examples = [
      ["student", 9000],
      ["employee", 18000],
      ["professor", 25000],
      ["manager", 30000],
    ] satisfies Array<[RequesterType, number]>;

    for (const [requesterType, expectedDailyAmountInCents] of examples) {
      const output = processTravelRequest(makeInput({ requesterType }));

      expect(output.dailyAmountInCents).toBe(expectedDailyAmountInCents);
    }
  });

  it("calculates subtotal and total amounts", () => {
    const output = processTravelRequest(
      makeInput({
        requesterType: "professor",
        departureDate: "2026-10-05",
        returnDate: "2026-10-08",
        transportCostInCents: 34567,
      }),
    );

    expect(output.travelDays).toBe(4);
    expect(output.subtotalInCents).toBe(100000);
    expect(output.totalAmountInCents).toBe(134567);
  });

  it("marks travel requests longer than five days as pending review", () => {
    const output = processTravelRequest(
      makeInput({
        departureDate: "2026-11-01",
        returnDate: "2026-11-06",
        reason: "Participate in a scheduled institutional workshop",
      }),
    );

    expect(output.status).toBe("pending-review");
    expect(output.travelDays).toBe(6);
  });

  it("marks travel requests above BRL 2,000.00 as pending review", () => {
    const output = processTravelRequest(
      makeInput({
        requesterType: "manager",
        departureDate: "2026-12-01",
        returnDate: "2026-12-05",
        transportCostInCents: 60000,
      }),
    );

    expect(output.status).toBe("pending-review");
    expect(output.totalAmountInCents).toBe(210000);
  });

  it("adds a warning for long travel requests with a short reason", () => {
    const output = processTravelRequest(
      makeInput({
        departureDate: "2027-01-10",
        returnDate: "2027-01-16",
        reason: "Meeting",
      }),
    );

    expect(output.warnings).toEqual([
      "long travel requests should include a detailed reason",
    ]);
  });

  it("rejects requests with missing required fields", () => {
    const output = processTravelRequest(
      makeInput({
        requestId: "",
        requesterName: "",
        requesterType: "" as RequesterType,
        destination: "",
        departureDate: "",
        returnDate: "",
      }),
    );

    expect(output.status).toBe("rejected");
    expect(output.errors).toEqual([
      "requestId is required",
      "requesterName is required",
      "requesterType is required",
      "destination is required",
      "departureDate is required",
      "returnDate is required",
    ]);
  });

  it("rejects requests with invalid date formats", () => {
    const output = processTravelRequest(
      makeInput({
        departureDate: "2026/08/10",
        returnDate: "2026-02-30",
      }),
    );

    expect(output.status).toBe("rejected");
    expect(output.errors).toEqual([
      "departureDate must be a valid YYYY-MM-DD date",
      "returnDate must be a valid YYYY-MM-DD date",
    ]);
  });

  it("rejects requests when returnDate is before departureDate", () => {
    const output = processTravelRequest(
      makeInput({
        departureDate: "2026-08-15",
        returnDate: "2026-08-14",
      }),
    );

    expect(output.status).toBe("rejected");
    expect(output.errors).toEqual(["returnDate cannot be before departureDate"]);
  });
});
