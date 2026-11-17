import { vi } from "vitest";
import { createHash } from "node:crypto";
import type { CreditChargeInput } from "@/lib/credits/charges/validateCreditCharge";
import { runContextAccountingAttempt } from "../runContextAccountingAttempt";
import type {
  ContextAccountingInput,
  ContextAccountingLedger,
  ContextAccountingServices,
} from "../types";

/** Synthetic journal and wallet services, never imported by production code. */
export function createAccountingFixture() {
  const ledger: ContextAccountingLedger = {
    attempts: new Map(),
    requestPolicies: new Map(),
    pilotPolicies: new Map(),
    cancelled: new Set(),
  };
  const ledgers = new Map<string, ContextAccountingLedger>([
    ["00000000-0000-4000-8000-000000000001", ledger],
  ]);
  const holds = new Map<
    string,
    {
      accountId: string;
      maximum: number;
      status: "held" | "settled" | "released";
      charge?: CreditChargeInput;
    }
  >();
  const holdId = (key: string) => "hold-v1-" + createHash("sha256").update(key).digest("hex");
  const input: ContextAccountingInput = {
    mode: "fixture",
    billing: "context_owned",
    payerId: "00000000-0000-4000-8000-000000000001",
    requestId: "request",
    pilotId: "pilot",
    moduleId: "module",
    attemptId: "attempt",
    pricingVersion: "fixture-price",
    maximumCredits: 6,
    requestCeiling: 6,
    pilotCeiling: 6,
  };
  let serial: Promise<unknown> = Promise.resolve();
  const fixture = {
    input,
    ledger,
    cancelled: false,
    debits: 0,
    reserve(args: { accountId: string; operationKey: string; creditsToReserve: number }) {
      const prior = holds.get(args.operationKey);
      if (prior && prior.accountId !== args.accountId) throw new Error("Payer mismatch");
      if (prior)
        return {
          state: "reused" as const,
          reservationId: holdId(args.operationKey),
          creditsHeld: prior.maximum,
          status: prior.status,
        };
      holds.set(args.operationKey, {
        accountId: args.accountId,
        maximum: args.creditsToReserve,
        status: "held",
      });
      return {
        state: "held" as const,
        reservationId: holdId(args.operationKey),
        creditsHeld: args.creditsToReserve,
        spendableCredits: 100,
      };
    },
    settle(args: CreditChargeInput) {
      const held = holds.get(args.operationKey)!;
      if (held.accountId !== args.accountId) throw new Error("Payer mismatch");
      if (held.status === "released" || args.creditsToDeduct > held.maximum)
        throw new Error("Rejected");
      if (held.charge && JSON.stringify(held.charge) !== JSON.stringify(args))
        throw new Error("Changed charge");
      const state = held.status === "settled" ? ("reused" as const) : ("settled" as const);
      if (state === "settled") fixture.debits++;
      held.status = "settled";
      held.charge = structuredClone(args);
      return {
        state,
        reservationId: holdId(args.operationKey),
        eventId: "charge-v1-" + createHash("sha256").update(args.operationKey).digest("hex"),
        creditsHeld: held.maximum,
        creditsCharged: args.creditsToDeduct,
        creditsReleased: held.maximum - args.creditsToDeduct,
      };
    },
    exposure() {
      return [...ledger.attempts.values()].reduce(
        (sum, a) =>
          sum +
          (["released", "insufficient", "reused"].includes(a.phase)
            ? 0
            : a.phase === "settled"
              ? a.completion!.customerCredits
              : a.input.maximumCredits),
        0,
      );
    },
    run(overrides: Partial<ContextAccountingInput> = {}) {
      return runContextAccountingAttempt({ ...input, ...overrides }, services);
    },
  };
  const services = {
    async transact<T>(_payer: string, action: (ledger: ContextAccountingLedger) => T): Promise<T> {
      const next = serial.then(() => {
        const current = ledgers.get(_payer) ?? {
          attempts: new Map(),
          requestPolicies: new Map(),
          pilotPolicies: new Map(),
          cancelled: new Set(),
        };
        const draft = structuredClone(current);
        if (fixture.cancelled) for (const key of draft.attempts.keys()) draft.cancelled.add(key);
        const result = action(draft);
        Object.assign(current, draft);
        ledgers.set(_payer, current);
        return result;
      });
      serial = next.catch(() => {});
      return next;
    },
    authorize: vi.fn(async () => {}),
    findAcceptedReuse: vi.fn<ContextAccountingServices["findAcceptedReuse"]>(async () => null),
    dispatch: vi.fn<ContextAccountingServices["dispatch"]>(async () => ({
      resultId: "result",
      usable: true,
      customerCredits: 4,
      providerExpense: { status: "unknown" },
      event: { source: "api", provider: "fixture-provider" },
    })),
    reserveCreditsOnce: vi.fn<ContextAccountingServices["reserveCreditsOnce"]>(async args =>
      fixture.reserve(args),
    ),
    settleCreditReservation: vi.fn<ContextAccountingServices["settleCreditReservation"]>(
      async args => fixture.settle(args),
    ),
    releaseCreditReservation: vi.fn<ContextAccountingServices["releaseCreditReservation"]>(
      async args => {
        const held = holds.get(args.operationKey)!;
        if (held.accountId !== args.accountId) throw new Error("Payer mismatch");
        if (held.status === "settled") throw new Error("Rejected");
        const state = held.status === "released" ? ("reused" as const) : ("released" as const);
        held.status = "released";
        return {
          state,
          reservationId: holdId(args.operationKey),
          creditsHeld: held.maximum,
          creditsReleased: held.maximum,
        };
      },
    ),
  };
  return {
    ...fixture,
    get cancelled() {
      return fixture.cancelled;
    },
    set cancelled(value: boolean) {
      fixture.cancelled = value;
    },
    get debits() {
      return fixture.debits;
    },
    services,
  };
}
