import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import client from "@/lib/supabase/serverClient";

const query = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), then: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn(() => query) } }));
beforeEach(() => {
  vi.clearAllMocks();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
});

describe("raw credits usage reader", () => {
  it("selects stored fields for exactly the supplied account without writes", async () => {
    const rows = [{ id: 7, remaining_credits: 123456, account_id: "synthetic-account" }];
    query.then.mockImplementation(resolve => resolve({ data: rows, error: null }));
    expect(await selectCreditsUsage({ account_id: "synthetic-account" })).toBe(rows);
    expect(client.from).toHaveBeenCalledExactlyOnceWith("credits_usage");
    expect(query.select).toHaveBeenCalledExactlyOnceWith();
    expect(query.eq).toHaveBeenCalledExactlyOnceWith("account_id", "synthetic-account");
  });

  it("preserves a successful empty list", async () => {
    query.then.mockImplementation(resolve => resolve({ data: [], error: null }));
    expect(await selectCreditsUsage({ account_id: "synthetic-account" })).toEqual([]);
  });

  it("propagates database failure instead of replacing it with missing data", async () => {
    const failure = { message: "synthetic database error" };
    query.then.mockImplementation(resolve => resolve({ data: null, error: failure }));
    await expect(selectCreditsUsage({ account_id: "synthetic-account" })).rejects.toBe(failure);
  });
});
