import type { TravelRequestInput, TravelRequestOutput } from "../main.js";
import { analyzeTravelRequest } from "../domain/travel-analysis.js";

export class ProcessTravelRequestUseCase {
  execute(input: TravelRequestInput): TravelRequestOutput {
    const analysis = analyzeTravelRequest(input);

    return {
      requestId: input.requestId,
      ...analysis,
    };
  }
}
