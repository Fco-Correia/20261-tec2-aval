import type { RequesterType } from "../main.js";

const DAILY_AMOUNTS_IN_CENTS: Record<RequesterType, number> = {
  student: 9000,
  employee: 18000,
  professor: 25000,
  manager: 30000,
};

export function getDailyAmountInCents(requesterType: RequesterType): number {
  return DAILY_AMOUNTS_IN_CENTS[requesterType] ?? 0;
}

export function calculateSubtotal(
  travelDays: number,
  dailyAmountInCents: number,
): number {
  return travelDays * dailyAmountInCents;
}

export function calculateTotal(
  subtotalInCents: number,
  transportCostInCents: number,
): number {
  return subtotalInCents + transportCostInCents;
}
