import type { TravelRequestInput, TravelRequestStatus } from "../main.js";
import {
  calculateInclusiveDays,
  isValidDate,
  toUtcTimestamp,
} from "./travel-date.js";
import {
  calculateSubtotal,
  calculateTotal,
  getDailyAmountInCents,
} from "./travel-pricing.js";
import { buildWarnings, determineStatus } from "./travel-status.js";
import { validateTravelRequest } from "./travel-validator.js";

export type TravelAnalysis = {
  status: TravelRequestStatus;
  travelDays: number;
  dailyAmountInCents: number;
  subtotalInCents: number;
  totalAmountInCents: number;
  errors: string[];
  warnings: string[];
};

function resolveTravelDays(input: TravelRequestInput): number {
  const hasValidDates =
    Boolean(input.departureDate) &&
    isValidDate(input.departureDate) &&
    Boolean(input.returnDate) &&
    isValidDate(input.returnDate);

  if (!hasValidDates) {
    return 0;
  }

  if (toUtcTimestamp(input.returnDate) < toUtcTimestamp(input.departureDate)) {
    return 0;
  }

  return calculateInclusiveDays(input.departureDate, input.returnDate);
}

export function analyzeTravelRequest(input: TravelRequestInput): TravelAnalysis {
  const errors = validateTravelRequest(input);

  const travelDays = resolveTravelDays(input);
  const dailyAmountInCents = getDailyAmountInCents(input.requesterType);
  const subtotalInCents = calculateSubtotal(travelDays, dailyAmountInCents);
  const totalAmountInCents = calculateTotal(
    subtotalInCents,
    input.transportCostInCents,
  );

  const warnings = buildWarnings(travelDays, input.reason);
  const status = determineStatus(errors, travelDays, totalAmountInCents);

  return {
    status,
    travelDays,
    dailyAmountInCents,
    subtotalInCents,
    totalAmountInCents,
    errors,
    warnings,
  };
}
