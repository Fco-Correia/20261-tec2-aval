import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { TravelRequestInput, TravelRequestOutput } from "../../src/main";
import { createPgPool } from "../../src/infra/database/pg-client";
import { PostgresTravelRequestRepository } from "../../src/infra/repositories/postgres-travel-request-repository";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgresTravelRequestRepository", () => {
  let pool: Pool;
  let repository: PostgresTravelRequestRepository;

  beforeAll(() => {
    pool = createPgPool(databaseUrl);
    repository = new PostgresTravelRequestRepository(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  function makeInput(requestId: string): TravelRequestInput {
    return {
      requestId,
      requesterName: "Ada Lovelace",
      requesterType: "employee",
      destination: "Teresina",
      departureDate: "2026-08-10",
      returnDate: "2026-08-12",
      reason: "Attend institutional technical meeting",
      transportCostInCents: 12000,
    };
  }

  function makeOutput(requestId: string): TravelRequestOutput {
    return {
      requestId,
      status: "approved",
      travelDays: 3,
      dailyAmountInCents: 18000,
      subtotalInCents: 54000,
      totalAmountInCents: 66000,
      errors: [],
      warnings: [],
    };
  }

  it("saves a travel request and retrieves it by id", async () => {
    const requestId = `TR-TEST-${Date.now()}`;

    await repository.save(makeInput(requestId), makeOutput(requestId));
    const saved = await repository.findById(requestId);

    expect(saved).not.toBeNull();
    expect(saved).toMatchObject({
      requestId,
      requesterName: "Ada Lovelace",
      status: "approved",
      travelDays: 3,
      dailyAmountInCents: 18000,
      subtotalInCents: 54000,
      transportCostInCents: 12000,
      totalAmountInCents: 66000,
    });
  });

  it("overwrites an existing travel request on conflicting id", async () => {
    const requestId = `TR-TEST-CONFLICT-${Date.now()}`;

    await repository.save(makeInput(requestId), makeOutput(requestId));
    await repository.save(makeInput(requestId), {
      ...makeOutput(requestId),
      status: "pending-review",
      totalAmountInCents: 250000,
    });

    const saved = await repository.findById(requestId);

    expect(saved?.status).toBe("pending-review");
    expect(saved?.totalAmountInCents).toBe(250000);
  });

  it("returns null when the travel request does not exist", async () => {
    const saved = await repository.findById("TR-DOES-NOT-EXIST");

    expect(saved).toBeNull();
  });
});
