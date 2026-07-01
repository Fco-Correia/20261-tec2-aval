import type { TravelRequestStatus } from "../main.js";

const MAX_REGULAR_TRAVEL_DAYS = 5;
const REVIEW_TOTAL_THRESHOLD_IN_CENTS = 200000;
const MIN_REASON_LENGTH = 30;

export function determineStatus(
  errors: string[],
  travelDays: number,
  totalAmountInCents: number,
): TravelRequestStatus {
  if (errors.length > 0) {
    return "rejected";
  }

  if (travelDays > MAX_REGULAR_TRAVEL_DAYS) {
    return "pending-review";
  }

  if (totalAmountInCents > REVIEW_TOTAL_THRESHOLD_IN_CENTS) {
    return "pending-review";
  }

  return "approved";
}

export function buildWarnings(travelDays: number, reason: string): string[] {
  const warnings: string[] = [];

  if (travelDays > MAX_REGULAR_TRAVEL_DAYS && reason.length < MIN_REASON_LENGTH) {
    warnings.push("long travel requests should include a detailed reason");
  }

  return warnings;
}
