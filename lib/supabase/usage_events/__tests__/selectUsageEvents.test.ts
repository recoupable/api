import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectUsageEvents } from "@/lib/supabase/usage_events/selectUsageEvents";
import supabase from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn() } }));

function chain(result: { data: unknown; error: unknown }) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "order", "range", "eq", "gte", "lt"]) q[m] = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q as Record<string, ReturnType<typeof vi.fn>> & { then: unknown };
}

beforeEach(() => vi.clearAllMocks());

describe("selectUsageEvents", () => {
  it("applies createdBefore as a strict upper bound on created_at", async () => {
    const q = chain({ data: [{ id: "a" }], error: null });
    vi.mocked(supabase.from).mockReturnValue(q as never);
    const rows = await selectUsageEvents({
      accountId: "acct",
      createdAfter: "2026-08-01T00:00:00.000Z",
      createdBefore: "2026-08-27T13:12:50.941Z",
      from: 0,
      to: 19,
    });
    expect(rows).toEqual([{ id: "a" }]);
    expect(q.eq).toHaveBeenCalledWith("account_id", "acct");
    expect(q.gte).toHaveBeenCalledWith("created_at", "2026-08-01T00:00:00.000Z");
    expect(q.lt).toHaveBeenCalledWith("created_at", "2026-08-27T13:12:50.941Z");
    expect(q.range).toHaveBeenCalledWith(0, 19);
  });

  it("adds no upper bound when createdBefore is omitted", async () => {
    const q = chain({ data: [], error: null });
    vi.mocked(supabase.from).mockReturnValue(q as never);
    await selectUsageEvents({ from: 0, to: 999 });
    expect(q.lt).not.toHaveBeenCalled();
    expect(q.eq).not.toHaveBeenCalled();
  });
});
