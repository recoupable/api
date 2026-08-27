import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectUsageEventsByAccount } from "@/lib/supabase/usage_events/selectUsageEventsByAccount";
import supabase from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn() } }));

const ACCOUNT_ID = "123e4567-e89b-12d3-a456-426614174000";
const base = {
  accountId: ACCOUNT_ID,
  from: "2026-08-01T00:00:00.000Z",
  to: "2026-08-27T12:00:00.000Z",
  limit: 20,
};

function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "eq", "gte", "lt", "order", "limit"]) {
    q[m] = vi.fn(() => q);
  }
  q.then = vi.fn((resolve: (v: unknown) => void) => resolve(result));
  vi.mocked(supabase.from).mockReturnValue(q as never);
  return q;
}

beforeEach(() => vi.clearAllMocks());

describe("selectUsageEventsByAccount", () => {
  it("filters to the account and period, newest first, limited", async () => {
    const q = chain({ data: [{ id: "a" }], error: null });
    const rows = await selectUsageEventsByAccount(base);
    expect(supabase.from).toHaveBeenCalledWith("usage_events");
    expect(q.eq).toHaveBeenCalledWith("account_id", ACCOUNT_ID);
    expect(q.gte).toHaveBeenCalledWith("created_at", base.from);
    expect(q.lt).toHaveBeenCalledWith("created_at", base.to);
    expect(q.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(q.limit).toHaveBeenCalledWith(20);
    expect(rows).toEqual([{ id: "a" }]);
  });

  it("applies the cursor as a strict upper bound on created_at", async () => {
    const q = chain({ data: [], error: null });
    await selectUsageEventsByAccount({ ...base, cursor: "2026-08-10T00:00:00.000Z" });
    expect(q.lt).toHaveBeenCalledWith("created_at", "2026-08-10T00:00:00.000Z");
    expect(q.lt).toHaveBeenCalledTimes(2);
  });

  it("throws on a query error", async () => {
    chain({ data: null, error: { message: "boom" } });
    await expect(selectUsageEventsByAccount(base)).rejects.toBeTruthy();
  });
});
