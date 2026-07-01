import type { Pool } from "pg";

import type {
  RequesterType,
  TravelRequestInput,
  TravelRequestOutput,
  TravelRequestStatus,
} from "../../main.js";
import type {
  SavedTravelRequest,
  TravelRequestRepository,
} from "../../application/ports/travel-request-repository.js";

type TravelRequestRow = {
  id: string;
  requester_name: string;
  requester_type: string;
  destination: string;
  departure_date: string;
  return_date: string;
  reason: string;
  status: string;
  travel_days: number;
  daily_amount_in_cents: number;
  subtotal_in_cents: number;
  transport_cost_in_cents: number;
  total_amount_in_cents: number;
  created_at: string;
};

export class PostgresTravelRequestRepository
  implements TravelRequestRepository
{
  constructor(private readonly pool: Pool) {}

  async save(
    input: TravelRequestInput,
    output: TravelRequestOutput,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO travel_requests (
        id, requester_name, requester_type, destination, departure_date,
        return_date, reason, status, travel_days, daily_amount_in_cents,
        subtotal_in_cents, transport_cost_in_cents, total_amount_in_cents, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        requester_name = EXCLUDED.requester_name,
        requester_type = EXCLUDED.requester_type,
        destination = EXCLUDED.destination,
        departure_date = EXCLUDED.departure_date,
        return_date = EXCLUDED.return_date,
        reason = EXCLUDED.reason,
        status = EXCLUDED.status,
        travel_days = EXCLUDED.travel_days,
        daily_amount_in_cents = EXCLUDED.daily_amount_in_cents,
        subtotal_in_cents = EXCLUDED.subtotal_in_cents,
        transport_cost_in_cents = EXCLUDED.transport_cost_in_cents,
        total_amount_in_cents = EXCLUDED.total_amount_in_cents,
        created_at = EXCLUDED.created_at`,
      [
        output.requestId,
        input.requesterName,
        input.requesterType,
        input.destination,
        input.departureDate,
        input.returnDate,
        input.reason,
        output.status,
        output.travelDays,
        output.dailyAmountInCents,
        output.subtotalInCents,
        input.transportCostInCents,
        output.totalAmountInCents,
        new Date().toISOString(),
      ],
    );
  }

  async findById(requestId: string): Promise<SavedTravelRequest | null> {
    const result = await this.pool.query<TravelRequestRow>(
      "SELECT * FROM travel_requests WHERE id = $1",
      [requestId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      requestId: row.id,
      requesterName: row.requester_name,
      requesterType: row.requester_type as RequesterType,
      destination: row.destination,
      departureDate: row.departure_date,
      returnDate: row.return_date,
      reason: row.reason,
      status: row.status as TravelRequestStatus,
      travelDays: row.travel_days,
      dailyAmountInCents: row.daily_amount_in_cents,
      subtotalInCents: row.subtotal_in_cents,
      transportCostInCents: row.transport_cost_in_cents,
      totalAmountInCents: row.total_amount_in_cents,
      createdAt: row.created_at,
    };
  }
}
