import type {
  RequesterType,
  TravelRequestInput,
  TravelRequestOutput,
  TravelRequestStatus,
} from "../main.js";

function isBadDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return true;
  }

  const chunks = value.split("-");
  const year = Number(chunks[0]);
  const month = Number(chunks[1]);
  const day = Number(chunks[2]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  );
}

function dayNumber(value: string): number {
  const chunks = value.split("-");
  return Date.UTC(Number(chunks[0]), Number(chunks[1]) - 1, Number(chunks[2]));
}

export function processTravelRequest(input: TravelRequestInput): TravelRequestOutput {
  const e: string[] = [];
  const w: string[] = [];
  let days = 0;
  let price = 0;
  let sub = 0;
  let total = 0;
  let status: TravelRequestStatus = "approved";

  // basic field checking
  if (!input.requestId) {
    e.push("requestId is required");
  }
  if (!input.requesterName) {
    e.push("requesterName is required");
  }
  if (!input.requesterType) {
    e.push("requesterType is required");
  }
  if (!input.destination) {
    e.push("destination is required");
  }
  if (!input.departureDate) {
    e.push("departureDate is required");
  }
  if (!input.returnDate) {
    e.push("returnDate is required");
  }

  let badStart = false;
  let badEnd = false;

  if (input.departureDate) {
    if (isBadDate(input.departureDate)) {
      e.push("departureDate must be a valid YYYY-MM-DD date");
      badStart = true;
    }
  } else {
    badStart = true;
  }

  if (input.returnDate) {
    if (isBadDate(input.returnDate)) {
      e.push("returnDate must be a valid YYYY-MM-DD date");
      badEnd = true;
    }
  } else {
    badEnd = true;
  }

  if (!badStart && !badEnd) {
    const a = dayNumber(input.departureDate);
    const b = dayNumber(input.returnDate);

    if (b < a) {
      e.push("returnDate cannot be before departureDate");
    } else {
      // inclusive date math
      days = Math.floor((b - a) / 86400000) + 1;
    }
  }

  if (input.requesterType === "student") {
    price = 9000;
  } else {
    if (input.requesterType === "employee") {
      price = 18000;
    } else {
      if (input.requesterType === "professor") {
        price = 25000;
      } else {
        if (input.requesterType === "manager") {
          price = 30000;
        } else {
          price = 0;
        }
      }
    }
  }

  sub = days * price;
  total = sub + input.transportCostInCents;

  if (days > 5) {
    if (input.reason.length < 30) {
      w.push("long travel requests should include a detailed reason");
    }
  }

  if (e.length > 0) {
    status = "rejected";
  } else {
    if (days > 5) {
      status = "pending-review";
    } else {
      if (total > 200000) {
        status = "pending-review";
      } else {
        status = "approved";
      }
    }
  }

  return {
    requestId: input.requestId,
    status,
    travelDays: days,
    dailyAmountInCents: price,
    subtotalInCents: sub,
    totalAmountInCents: total,
    errors: e,
    warnings: w,
  };
}

const _keepsLegacyTypesNearby: RequesterType[] = [
  "student",
  "employee",
  "professor",
  "manager",
];

void _keepsLegacyTypesNearby;
