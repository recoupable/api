import { expect, it } from "vitest";
import { runContextAccountingAttempt } from "../runContextAccountingAttempt";
import { reconcileContextAccountingAttempt } from "../reconcileContextAccountingAttempt";
import type { ContextAccountingServices } from "../types";
import { createAccountingFixture } from "./createAccountingFixture";

it("serializes concurrent module admission against a supplied request ceiling", async () => {
  const f = createAccountingFixture();
  const results = await Promise.all([f.run(), f.run({ moduleId: "other", attemptId: "other" })]);
  expect(results.map(r => r.state).sort()).toEqual(["denied", "settled"]);
  expect(f.services.dispatch).toHaveBeenCalledTimes(1);
  expect(f.services.reserveCreditsOnce).toHaveBeenCalledTimes(1);
});
it("counts settled consumption and outstanding work against a shared pilot across requests", async () => {
  const f = createAccountingFixture();
  await f.run();
  expect((await f.run({ requestId: "other", attemptId: "other" })).state).toBe("denied");
});
it("never grants duplicate delivery a second provider call", async () => {
  const f = createAccountingFixture();
  await Promise.all([f.run(), f.run()]);
  expect(f.services.dispatch).toHaveBeenCalledTimes(1);
  expect(f.services.settleCreditReservation).toHaveBeenCalledTimes(1);
});
it("releases a cancellation that wins before durable dispatch intent", async () => {
  const f = createAccountingFixture();
  f.services.reserveCreditsOnce.mockImplementationOnce(async args => {
    f.cancelled = true;
    return f.reserve(args);
  });
  expect((await f.run()).state).toBe("released");
  expect(f.services.dispatch).not.toHaveBeenCalled();
  expect(f.services.releaseCreditReservation).toHaveBeenCalledTimes(1);
  expect(f.exposure()).toBe(0);
});
it("retains provider completion after a lost settlement reply and reconciles without dispatch", async () => {
  const f = createAccountingFixture();
  f.services.settleCreditReservation.mockImplementationOnce(async args => {
    f.settle(args);
    throw new Error("private-lost-reply");
  });
  expect((await f.run()).state).toBe("pending_reconciliation");
  expect(f.exposure()).toBe(6);
  expect((await f.run()).state).toBe("pending_reconciliation");
  expect((await reconcileContextAccountingAttempt(f.input, f.services)).state).toBe("settled");
  expect(f.services.dispatch).toHaveBeenCalledTimes(1);
  expect(f.debits).toBe(1);
  expect(f.exposure()).toBe(4);
});
it("keeps unknown provider expense reserved without timeout release or redispatch", async () => {
  const f = createAccountingFixture();
  f.services.dispatch.mockRejectedValue(new Error("private-token"));
  const result = await f.run();
  expect(result.state).toBe("pending_reconciliation");
  expect(JSON.stringify(result)).not.toContain("private-token");
  await reconcileContextAccountingAttempt(f.input, f.services);
  await f.run();
  expect(f.services.dispatch).toHaveBeenCalledTimes(1);
  expect(f.services.releaseCreditReservation).not.toHaveBeenCalled();
  expect(f.exposure()).toBe(6);
});
it("reuses verified analysis without provider invocation or a second debit", async () => {
  const f = createAccountingFixture();
  f.services.findAcceptedReuse.mockResolvedValue({ resultId: "retained-analysis" });
  expect((await f.run()).state).toBe("reused");
  expect(f.services.reserveCreditsOnce).not.toHaveBeenCalled();
  expect(f.services.dispatch).not.toHaveBeenCalled();
  expect(f.services.settleCreditReservation).not.toHaveBeenCalled();
});
it("rejects nesting around an endpoint that already owns its charge", async () => {
  const f = createAccountingFixture();
  await expect(
    runContextAccountingAttempt({ ...f.input, billing: "endpoint_owned" }, f.services),
  ).rejects.toThrow();
  expect(f.services.reserveCreditsOnce).not.toHaveBeenCalled();
  expect(f.services.dispatch).not.toHaveBeenCalled();
});
it("rejects missing fixture mode before authorization", async () => {
  const f = createAccountingFixture();
  await expect(
    runContextAccountingAttempt({ ...f.input, mode: undefined }, f.services),
  ).rejects.toThrow(/mode/);
  expect(f.services.authorize).not.toHaveBeenCalled();
});

it("retains admission when reserve may have committed before its reply was lost", async () => {
  const f = createAccountingFixture();
  f.services.reserveCreditsOnce.mockImplementationOnce(async args => {
    f.reserve(args);
    throw new Error("lost reservation acknowledgement");
  });
  expect((await f.run()).state).toBe("pending_reconciliation");
  await f.run();
  expect(f.services.dispatch).not.toHaveBeenCalled();
  expect(f.services.reserveCreditsOnce).toHaveBeenCalledTimes(1);
  expect(f.exposure()).toBe(6);
});
it("does not treat a preexisting held wallet receipt as a dispatch lease", async () => {
  const f = createAccountingFixture();
  f.services.reserveCreditsOnce.mockImplementationOnce(async args => {
    f.reserve(args);
    return f.reserve(args);
  });
  expect((await f.run()).state).toBe("pending_reconciliation");
  expect(f.services.dispatch).not.toHaveBeenCalled();
});
it("does not turn a later accepted result into proof of settlement for an uncertain attempt", async () => {
  const f = createAccountingFixture();
  f.services.dispatch.mockRejectedValue(new Error("unknown"));
  await f.run();
  f.services.findAcceptedReuse.mockResolvedValue({ resultId: "now-cached" });
  expect((await f.run()).state).toBe("pending_reconciliation");
  expect(f.exposure()).toBe(6);
});
it("retains paid-but-unusable costs separately from customer debit", async () => {
  const f = createAccountingFixture();
  f.services.dispatch.mockResolvedValue({
    resultId: "unusable-result",
    usable: false,
    customerCredits: 4,
    providerExpense: { status: "confirmed", usd: 0.02 },
    event: { source: "api" },
  });
  const result = await f.run();
  expect(result).toMatchObject({
    state: "settled",
    completion: {
      usable: false,
      customerCredits: 4,
      providerExpense: { status: "confirmed", usd: 0.02 },
    },
  });
});
it("releases waived customer charge while preserving known provider expense", async () => {
  const f = createAccountingFixture();
  f.services.dispatch.mockResolvedValue({
    resultId: "waived",
    usable: false,
    customerCredits: 0,
    providerExpense: { status: "confirmed", usd: 0.02 },
    event: {},
  });
  expect(await f.run()).toMatchObject({
    state: "released",
    completion: { customerCredits: 0, providerExpense: { usd: 0.02 } },
  });
  expect(f.services.settleCreditReservation).not.toHaveBeenCalled();
  expect(f.exposure()).toBe(0);
});
it("keeps dispatch-won cancellation from refunding potentially paid work", async () => {
  const f = createAccountingFixture();
  f.services.dispatch.mockImplementationOnce(async () => {
    f.cancelled = true;
    throw new Error("unknown provider outcome");
  });
  await f.run();
  await reconcileContextAccountingAttempt(f.input, f.services);
  expect(f.services.releaseCreditReservation).not.toHaveBeenCalled();
  expect(f.exposure()).toBe(6);
});
it("rejects changed attempt prices and changed request/pilot limits", async () => {
  const f = createAccountingFixture();
  await f.run();
  await expect(f.run({ maximumCredits: 5 })).rejects.toThrow("Attempt terms changed");
  await expect(f.run({ attemptId: "new", requestCeiling: 100 })).rejects.toThrow(
    "Budget terms changed",
  );
  await expect(f.run({ attemptId: "new", requestId: "new", pilotCeiling: 100 })).rejects.toThrow(
    "Budget terms changed",
  );
  await expect(f.run({ attemptId: "new", pilotId: "new" })).rejects.toThrow("Budget terms changed");
});
it("does not free capacity after a definite settlement rejection", async () => {
  const f = createAccountingFixture();
  f.services.settleCreditReservation.mockRejectedValue(new Error("SQLSTATE22023"));
  expect((await f.run()).state).toBe("pending_reconciliation");
  expect(f.exposure()).toBe(6);
  expect((await f.run({ attemptId: "second" })).state).toBe("denied");
});
it("reconciles a lost release reply without provider work or a zero-credit settlement", async () => {
  const f = createAccountingFixture();
  f.cancelled = true;
  const release = f.services.releaseCreditReservation.getMockImplementation()!;
  f.services.releaseCreditReservation.mockImplementationOnce(async args => {
    await release(args);
    throw new Error("lost");
  });
  expect((await f.run()).state).toBe("pending_reconciliation");
  expect(f.exposure()).toBe(6);
  expect((await reconcileContextAccountingAttempt(f.input, f.services)).state).toBe("released");
  expect(f.exposure()).toBe(0);
  expect(f.services.dispatch).not.toHaveBeenCalled();
  expect(f.services.settleCreditReservation).not.toHaveBeenCalled();
});
it("denies insufficient wallet funds without provider work and releases admission capacity", async () => {
  const f = createAccountingFixture();
  f.services.reserveCreditsOnce.mockResolvedValue({
    state: "insufficient",
    creditsRequested: 6,
    spendableCredits: 0,
  });
  expect((await f.run()).state).toBe("insufficient");
  expect(f.exposure()).toBe(0);
  expect(f.services.dispatch).not.toHaveBeenCalled();
});
it("keeps a rejected completion payload pending rather than guessing the charge", async () => {
  const f = createAccountingFixture();
  f.services.dispatch.mockResolvedValue({
    resultId: "too-expensive",
    usable: true,
    customerCredits: 7,
    providerExpense: { status: "unknown" },
    event: {},
  });
  expect((await f.run()).state).toBe("pending_reconciliation");
  expect(f.services.settleCreditReservation).not.toHaveBeenCalled();
  expect(f.exposure()).toBe(6);
});
it("rechecks reuse atomically after another delivery starts or completes", async () => {
  const f = createAccountingFixture();
  let resume!: (value: { resultId: string }) => void;
  const held = new Promise<{ resultId: string }>(resolve => {
    resume = resolve;
  });
  f.services.findAcceptedReuse.mockImplementationOnce(() => held);
  const delayed = f.run();
  while (!f.services.findAcceptedReuse.mock.calls.length)
    await new Promise(resolve => setTimeout(resolve, 0));
  await f.run();
  resume({ resultId: "cached" });
  expect(await delayed).toMatchObject({
    state: "settled",
    completion: { resultId: "result", customerCredits: 4 },
  });
});
it("persists reused attempt identity even if cache later disappears", async () => {
  const f = createAccountingFixture();
  f.services.findAcceptedReuse.mockResolvedValueOnce({ resultId: "cached" });
  expect(await f.run()).toMatchObject({ state: "reused", resultId: "cached", customerCredits: 0 });
  expect(await f.run()).toMatchObject({ state: "reused", resultId: "cached", customerCredits: 0 });
  await expect(f.run({ maximumCredits: 5 })).rejects.toThrow("Attempt terms changed");
  expect(f.services.dispatch).not.toHaveBeenCalled();
});
it("keeps two payers' same-named budget scopes separate", async () => {
  const f = createAccountingFixture();
  expect((await f.run()).state).toBe("settled");
  expect((await f.run({ payerId: "00000000-0000-4000-8000-000000000002" })).state).toBe("settled");
});
it.each(["state", "eventId"])(
  "rejects malformed settlement %s before freeing exposure",
  async field => {
    const f = createAccountingFixture();
    f.services.settleCreditReservation.mockImplementationOnce(async args => {
      const receipt = f.settle(args);
      return { ...receipt, [field]: undefined } as never;
    });
    expect((await f.run()).state).toBe("pending_reconciliation");
    expect(f.exposure()).toBe(6);
  },
);

it("canonicalizes payer UUID case before admission and replay", async () => {
  const f = createAccountingFixture();
  const payerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await f.run({ payerId });
  await f.run({ payerId: payerId.toUpperCase() });
  expect(f.services.dispatch).toHaveBeenCalledTimes(1);
});
it.each(["held", "insufficient"])(
  "retains uncertainty for malformed %s reservation receipt",
  async state => {
    const f = createAccountingFixture();
    f.services.reserveCreditsOnce.mockResolvedValueOnce({
      state,
      reservationId: "hold-v1-" + "a".repeat(64),
      creditsHeld: 6,
      creditsRequested: 6,
    } as never);
    expect((await f.run()).state).toBe("pending_reconciliation");
    expect(f.exposure()).toBe(6);
    expect(f.services.dispatch).not.toHaveBeenCalled();
  },
);

it("accepts definite insufficient receipts with signed spendable credits", async () => {
  const f = createAccountingFixture();
  f.services.reserveCreditsOnce.mockResolvedValueOnce({
    state: "insufficient",
    creditsRequested: 6,
    spendableCredits: -1,
  });
  expect((await f.run()).state).toBe("insufficient");
  expect(f.exposure()).toBe(0);
  expect(f.services.dispatch).not.toHaveBeenCalled();
});

it("releases a hold when authorization fails before dispatch intent", async () => {
  const f = createAccountingFixture();
  f.services.authorize.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Revoked"));
  expect((await f.run()).state).toBe("released");
  expect(f.exposure()).toBe(0);
  expect(f.services.dispatch).not.toHaveBeenCalled();
  expect(f.services.releaseCreditReservation).toHaveBeenCalledTimes(1);
});

it("requires synchronous transaction callbacks at the service boundary", () => {
  const services: ContextAccountingServices = createAccountingFixture().services;
  if (false) {
    // @ts-expect-error Durable transaction mutations must complete synchronously.
    void services.transact("payer", async () => 1);
  }
  expect(services.transact).toBeTypeOf("function");
});

it("fixture wallet rejects another payer reusing an operation key", async () => {
  const f = createAccountingFixture();
  await f.run();
  const args = f.services.reserveCreditsOnce.mock.calls[0][0];
  expect(() => f.reserve({ ...args, accountId: "another-payer" })).toThrow("Payer mismatch");
});
