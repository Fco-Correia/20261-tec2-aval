import { describe, expect, it, vi } from "vitest";

import type { TravelRequestInput, TravelRequestOutput } from "../../src/main";
import { ProcessTravelRequestUseCase } from "../../src/application/process-travel-request-use-case";
import type {
  SavedTravelRequest,
  TravelRequestRepository,
} from "../../src/application/ports/travel-request-repository";

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

class FakeTravelRequestRepository implements TravelRequestRepository {
  readonly saved: {
    input: TravelRequestInput;
    output: TravelRequestOutput;
  }[] = [];
  saveError: Error | null = null;

  async save(
    input: TravelRequestInput,
    output: TravelRequestOutput,
  ): Promise<void> {
    if (this.saveError) {
      throw this.saveError;
    }
    this.saved.push({ input, output });
  }

  async findById(): Promise<SavedTravelRequest | null> {
    return null;
  }
}

const flushPromises = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

describe("ProcessTravelRequestUseCase", () => {
  it("builds the approved output including the requestId", () => {
    const useCase = new ProcessTravelRequestUseCase();

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
    const useCase = new ProcessTravelRequestUseCase();

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
    const useCase = new ProcessTravelRequestUseCase();

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

  it("processes the request without persisting when no repository is provided", () => {
    const useCase = new ProcessTravelRequestUseCase();

    expect(() => useCase.execute(makeInput())).not.toThrow();
  });

  it("persists the produced output through the injected repository", async () => {
    const repository = new FakeTravelRequestRepository();
    const useCase = new ProcessTravelRequestUseCase(repository);

    const output = useCase.execute(makeInput());
    await flushPromises();

    expect(repository.saved).toHaveLength(1);
    expect(repository.saved[0]?.input).toEqual(makeInput());
    expect(repository.saved[0]?.output).toEqual(output);
  });

  it("returns the output synchronously instead of a promise", () => {
    const repository = new FakeTravelRequestRepository();
    const useCase = new ProcessTravelRequestUseCase(repository);

    const output = useCase.execute(makeInput());

    expect(output).not.toBeInstanceOf(Promise);
    expect(output.status).toBe("approved");
  });

  it("still returns the output when persistence fails", async () => {
    const repository = new FakeTravelRequestRepository();
    repository.saveError = new Error("database unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const useCase = new ProcessTravelRequestUseCase(repository);

    const output = useCase.execute(makeInput());
    await flushPromises();

    expect(output.status).toBe("approved");
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
