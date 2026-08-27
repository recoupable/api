import { describe, it, expect, vi, beforeEach } from "vitest";
import { sumUsageEventsByAccount } from "@/lib/supabase/usage_events/sumUsageEventsByAccount";
import supabase from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn() } }));

const ACCOUNT_ID = "123e4567-e89b-12d3-a456-426614174000";
const params = {
  accountId: ACCOUNT_ID,
  from: "2026-08-01T00:00:00.000Z",
  to: "2026-08-27T12:00:00.000Z",
};

function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "eq", "gte", "lt"]) q[m] = vi.fn(() => q);
  q.then = vi.fn((resolve: (v: unknown) => void) => resolve(result));
  vi.mocked(supabase.from).mockReturnValue(q as never);
  return q;
}

beforeEach(() => vi.clearAllMocks());

describe("sumUsageEventsByAccount", () => {
  it("sums in Postgres over the account and period, one round trip", async () => {
    const q = chain({ data: [{ sum: 70000 }], error: null });
    const total = await sumUsageEventsByAccount(params);
    expect(supabase.from).toHaveBeenCalledWith("usage_events");
    expect(q.select).toHaveBeenCalledWith("credits_deducted.sum()");
    expect(q.eq).toHaveBeenCalledWith("account_id", ACCOUNT_ID);
    expect(q.gte).toHaveBeenCalledWith("created_at", params.from);
    expect(q.lt).toHaveBeenCalledWith("created_at", params.to);
    expect(total).toBe(70000);
  });

  it("is 0 when the period has no events", async () => {
    chain({ data: [{ sum: null }], error: null });
    expect(await sumUsageEventsByAccount(params)).toBe(0);
  });

  it("throws on a query error", async () => {
    chain({ data: null, error: { message: "boom" } });
    await expect(sumUsageEventsByAccount(params)).rejects.toBeTruthy();
  });
});
