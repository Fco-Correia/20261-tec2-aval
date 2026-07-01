export type RequesterType = "student" | "employee" | "professor" | "manager";

export type TravelRequestStatus = "approved" | "pending-review" | "rejected";

export type TravelRequestInput = {
  requestId: string;
  requesterName: string;
  requesterType: RequesterType;
  destination: string;
  departureDate: string;
  returnDate: string;
  reason: string;
  transportCostInCents: number;
};

export type TravelRequestOutput = {
  requestId: string;
  status: TravelRequestStatus;
  travelDays: number;
  dailyAmountInCents: number;
  subtotalInCents: number;
  totalAmountInCents: number;
  errors: string[];
  warnings: string[];
};

import { ProcessTravelRequestUseCase } from "./application/process-travel-request-use-case.js";

const processTravelRequestUseCase = new ProcessTravelRequestUseCase();

export function processTravelRequest(
  input: TravelRequestInput,
): TravelRequestOutput {
  return processTravelRequestUseCase.execute(input);
}
