import { describe, expect, it } from "vitest";

import type { RequesterType } from "../../src/main";
import {
  calculateSubtotal,
  calculateTotal,
  getDailyAmountInCents,
} from "../../src/domain/travel-pricing";

describe("getDailyAmountInCents", () => {
  it("returns the daily amount for each requester type", () => {
    expect(getDailyAmountInCents("student")).toBe(9000);
    expect(getDailyAmountInCents("employee")).toBe(18000);
    expect(getDailyAmountInCents("professor")).toBe(25000);
    expect(getDailyAmountInCents("manager")).toBe(30000);
  });

  it("returns zero for an unknown requester type", () => {
    expect(getDailyAmountInCents("" as RequesterType)).toBe(0);
  });
});

describe("calculateSubtotal", () => {
  it("multiplies travel days by the daily amount", () => {
    expect(calculateSubtotal(3, 18000)).toBe(54000);
  });

  it("returns zero when there are no travel days", () => {
    expect(calculateSubtotal(0, 18000)).toBe(0);
  });
});

describe("calculateTotal", () => {
  it("adds the transport cost to the subtotal", () => {
    expect(calculateTotal(54000, 12000)).toBe(66000);
  });

  it("returns the subtotal when transport cost is zero", () => {
    expect(calculateTotal(54000, 0)).toBe(54000);
  });
});
