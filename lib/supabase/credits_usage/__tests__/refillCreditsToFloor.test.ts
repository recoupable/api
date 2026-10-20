import { beforeEach, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import supabase from "@/lib/supabase/serverClient";
import { refillCreditsToFloor } from "../refillCreditsToFloor";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn(), from: vi.fn() } }));

const ACCOUNT = "123e4567-e89b-42d3-a456-426614174000";
const OBSERVED = "2026-04-01T09:30:00.123456";
const receipt = { state: "raised", remainingCredits: 1000, timestamp: "2026-05-11T12:00:00" };

beforeEach(() => vi.clearAllMocks());

it.each(["raised", "unchanged", "superseded"])(
  "sends the floor and the observed refill timestamp to the atomic RPC and returns a validated %s receipt",
  async state => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { ...receipt, state },
      error: null,
    } as never);

    await expect(
      refillCreditsToFloor({ accountId: ACCOUNT, floor: 1000, expectedTimestamp: OBSERVED }),
    ).resolves.toEqual({ ...receipt, state });

    expect(supabase.rpc).toHaveBeenCalledOnce();
    expect(supabase.rpc).toHaveBeenCalledWith("refill_credits_to_floor", {
      p_account_id: ACCOUNT,
      p_floor: 1000,
      p_expected_timestamp: OBSERVED,
    });
    // The floor is applied by the database; no balance is read or written here.
    expect(supabase.from).not.toHaveBeenCalled();
  },
);

it("returns the database's balance when it is already above the floor", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { ...receipt, state: "unchanged", remainingCredits: 2500 },
    error: null,
  } as never);

  const result = await refillCreditsToFloor({
    accountId: ACCOUNT,
    floor: 0,
    expectedTimestamp: OBSERVED,
  });

  expect(result.remainingCredits).toBe(2500);
  expect(supabase.rpc).toHaveBeenCalledWith("refill_credits_to_floor", {
    p_account_id: ACCOUNT,
    p_floor: 0,
    p_expected_timestamp: OBSERVED,
  });
});

it("returns the current balance unchanged when another refill already took this period", async () => {
  // The database compares the observed timestamp under the row lock; a second
  // refill for the same period must not raise a balance a debit has since lowered.
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: { state: "superseded", remainingCredits: 800, timestamp: "2026-05-11T12:00:01" },
    error: null,
  } as never);

  await expect(
    refillCreditsToFloor({ accountId: ACCOUNT, floor: 1000, expectedTimestamp: OBSERVED }),
  ).resolves.toEqual({
    state: "superseded",
    remainingCredits: 800,
    timestamp: "2026-05-11T12:00:01",
  });
  expect(supabase.rpc).toHaveBeenCalledOnce();
});

it("throws the database error without retrying", async () => {
  const error = { message: "Credit wallet is unavailable or ambiguous" };
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);

  await expect(
    refillCreditsToFloor({ accountId: ACCOUNT, floor: 1000, expectedTimestamp: OBSERVED }),
  ).rejects.toBe(error);
  expect(supabase.rpc).toHaveBeenCalledOnce();
});

it.each([
  null,
  { ...receipt, state: "lowered" },
  { remainingCredits: 1000 },
  { ...receipt, remainingCredits: 1.5 },
  { ...receipt, extra: true },
])("rejects an invalid receipt with a validation error: %j", async data => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as never);

  await expect(
    refillCreditsToFloor({ accountId: ACCOUNT, floor: 1000, expectedTimestamp: OBSERVED }),
  ).rejects.toBeInstanceOf(ZodError);
});

it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  "rejects floor %s before touching the wallet",
  async floor => {
    await expect(
      refillCreditsToFloor({ accountId: ACCOUNT, floor, expectedTimestamp: OBSERVED }),
    ).rejects.toThrow(/non-negative integer/);
    expect(supabase.rpc).not.toHaveBeenCalled();
  },
);

it("rejects a missing observed timestamp before touching the wallet", async () => {
  await expect(
    refillCreditsToFloor({ accountId: ACCOUNT, floor: 1000, expectedTimestamp: "" }),
  ).rejects.toThrow(/observed refill timestamp/);
  expect(supabase.rpc).not.toHaveBeenCalled();
});
