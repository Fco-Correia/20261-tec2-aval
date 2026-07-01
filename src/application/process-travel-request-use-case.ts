import type { TravelRequestInput, TravelRequestOutput } from "../main.js";
import { analyzeTravelRequest } from "../domain/travel-analysis.js";
import type { TravelRequestRepository } from "./ports/travel-request-repository.js";

export class ProcessTravelRequestUseCase {
  constructor(private readonly repository?: TravelRequestRepository) {}

  execute(input: TravelRequestInput): TravelRequestOutput {
    const analysis = analyzeTravelRequest(input);

    const output: TravelRequestOutput = {
      requestId: input.requestId,
      ...analysis,
    };

    void this.persist(input, output);

    return output;
  }

  private persist(
    input: TravelRequestInput,
    output: TravelRequestOutput,
  ): Promise<void> {
    if (!this.repository) {
      return Promise.resolve();
    }

    return this.repository.save(input, output).catch((error: unknown) => {
      console.error("Failed to persist travel request", error);
    });
  }
}
