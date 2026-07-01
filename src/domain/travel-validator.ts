import type { TravelRequestInput } from "../main.js";
import { isValidDate, toUtcTimestamp } from "./travel-date.js";

export function validateTravelRequest(input: TravelRequestInput): string[] {
  const errors: string[] = [];

  if (!input.requestId) {
    errors.push("requestId is required");
  }
  if (!input.requesterName) {
    errors.push("requesterName is required");
  }
  if (!input.requesterType) {
    errors.push("requesterType is required");
  }
  if (!input.destination) {
    errors.push("destination is required");
  }
  if (!input.departureDate) {
    errors.push("departureDate is required");
  }
  if (!input.returnDate) {
    errors.push("returnDate is required");
  }

  let badStart = false;
  let badEnd = false;

  if (input.departureDate) {
    if (!isValidDate(input.departureDate)) {
      errors.push("departureDate must be a valid YYYY-MM-DD date");
      badStart = true;
    }
  } else {
    badStart = true;
  }

  if (input.returnDate) {
    if (!isValidDate(input.returnDate)) {
      errors.push("returnDate must be a valid YYYY-MM-DD date");
      badEnd = true;
    }
  } else {
    badEnd = true;
  }

  if (!badStart && !badEnd) {
    const departureTimestamp = toUtcTimestamp(input.departureDate);
    const returnTimestamp = toUtcTimestamp(input.returnDate);

    if (returnTimestamp < departureTimestamp) {
      errors.push("returnDate cannot be before departureDate");
    }
  }

  return errors;
}
