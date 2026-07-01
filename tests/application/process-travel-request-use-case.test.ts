import { describe, expect, it } from "vitest";

import type { TravelRequestInput } from "../../src/main";
import { ProcessTravelRequestUseCase } from "../../src/application/process-travel-request-use-case";

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

describe("ProcessTravelRequestUseCase", () => {
  const useCase = new ProcessTravelRequestUseCase();

  it("builds the approved output including the requestId", () => {
    const output = useCase.execute(makeInput());

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

  it("rejects invalid requests and echoes the received requestId", () => {
    const output = useCase.execute(
      makeInput({ requestId: "", departureDate: "2026/08/10" }),
    );

    expect(output.requestId).toBe("");
    expect(output.status).toBe("rejected");
    expect(output.errors).toEqual([
      "requestId is required",
      "departureDate must be a valid YYYY-MM-DD date",
    ]);
  });

  it("marks long travels with a short reason as pending-review with a warning", () => {
    const output = useCase.execute(
      makeInput({
        departureDate: "2026-08-10",
        returnDate: "2026-08-20",
        reason: "short",
      }),
    );

    expect(output.status).toBe("pending-review");
    expect(output.warnings).toEqual([
      "long travel requests should include a detailed reason",
    ]);
  });
});
