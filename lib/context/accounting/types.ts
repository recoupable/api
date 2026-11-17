import type { CreditChargeInput } from "@/lib/credits/charges/validateCreditCharge";

export interface ContextAccountingInput {
  mode: "fixture";
  billing: "context_owned";
  payerId: string;
  requestId: string;
  pilotId: string;
  moduleId: string;
  attemptId: string;
  pricingVersion: string;
  maximumCredits: number;
  requestCeiling: number;
  pilotCeiling: number;
}
export interface ContextAccountingCompletion {
  resultId: string;
  usable: boolean;
  customerCredits: number;
  providerExpense: { status: "unknown" } | { status: "confirmed" | "estimated"; usd: number };
  event: CreditChargeInput["event"];
}
export interface ContextAccountingAttempt {
  input: ContextAccountingInput;
  operationKey: string;
  phase:
    | "reused"
    | "admitted"
    | "held"
    | "dispatching"
    | "completed"
    | "settled"
    | "released"
    | "insufficient"
    | "cancelled";
  reuseResultId?: string;
  completion?: ContextAccountingCompletion;
  reservationId?: string;
}
export interface ContextAccountingLedger {
  attempts: Map<string, ContextAccountingAttempt>;
  requestPolicies: Map<string, { pilotId: string; ceiling: number }>;
  pilotPolicies: Map<string, number>;
  cancelled: Set<string>;
}
export interface ContextAccountingServices {
  /** Atomic, isolated, durable transaction over a payer-PARTITIONED ledger; callback is synchronous. No live implementation exists. */
  transact<T>(
    payerId: string,
    action: (
      ledger: ContextAccountingLedger,
    ) => T & ([Extract<T, PromiseLike<unknown>>] extends [never] ? unknown : never),
  ): Promise<T>;
  authorize(input: ContextAccountingInput): Promise<void>;
  /** Must establish authorized, accepted retained evidence; a planner reuse_candidate is insufficient. */
  findAcceptedReuse(input: ContextAccountingInput): Promise<{ resultId: string } | null>;
  /** Inject ONLY a provider leaf with no existing endpoint/workflow debit. */
  dispatch(input: ContextAccountingInput): Promise<ContextAccountingCompletion>;
  // Structural ports for API1026, pinned in README. No wallet implementation is duplicated here.
  reserveCreditsOnce(input: {
    accountId: string;
    operationKey: string;
    creditsToReserve: number;
  }): Promise<
    | { state: "held"; reservationId: string; creditsHeld: number; spendableCredits: number }
    | {
        state: "reused";
        reservationId: string;
        status: "held" | "settled" | "released";
        creditsHeld: number;
      }
    | { state: "insufficient"; creditsRequested: number; spendableCredits: number }
  >;
  settleCreditReservation(input: CreditChargeInput): Promise<{
    state: "settled" | "reused";
    reservationId: string;
    eventId: string;
    creditsHeld: number;
    creditsCharged: number;
    creditsReleased: number;
  }>;
  releaseCreditReservation(input: { accountId: string; operationKey: string }): Promise<{
    state: "released" | "reused";
    reservationId: string;
    creditsHeld: number;
    creditsReleased: number;
  }>;
}
