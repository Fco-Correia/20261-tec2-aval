import type {
  RequesterType,
  TravelRequestInput,
  TravelRequestOutput,
  TravelRequestStatus,
} from "../../main.js";

export type SavedTravelRequest = {
  requestId: string;
  requesterName: string;
  requesterType: RequesterType;
  destination: string;
  departureDate: string;
  returnDate: string;
  reason: string;
  status: TravelRequestStatus;
  travelDays: number;
  dailyAmountInCents: number;
  subtotalInCents: number;
  transportCostInCents: number;
  totalAmountInCents: number;
  createdAt: string;
};

export interface TravelRequestRepository {
  save(input: TravelRequestInput, output: TravelRequestOutput): Promise<void>;
  findById(requestId: string): Promise<SavedTravelRequest | null>;
}
