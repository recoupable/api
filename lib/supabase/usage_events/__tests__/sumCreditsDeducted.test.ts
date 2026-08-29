import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn() } }));

const { sumCreditsDeducted } = await import("../sumCreditsDeducted");

function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (v: unknown) => void) => void;
  } = {} as never;
  for (const m of ["select", "eq", "gte", "lt", "range"])
    builder[m] = vi.fn().mockReturnValue(builder);
  builder.then = resolve => resolve(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

describe("sumCreditsDeducted", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sums credits_deducted for the account since the given time", async () => {
    const builder = mockBuilder({
      data: [{ credits_deducted: 1_500_000 }, { credits_deducted: 250_000 }],
      error: null,
    });

    const total = await sumCreditsDeducted({
      accountId: "acc_1",
      createdAfter: "2026-08-01T00:00:00Z",
    });

    expect(supabase.from).toHaveBeenCalledWith("usage_events");
    expect(builder.select).toHaveBeenCalledWith("credits_deducted");
    expect(builder.eq).toHaveBeenCalledWith("account_id", "acc_1");
    expect(builder.gte).toHaveBeenCalledWith("created_at", "2026-08-01T00:00:00Z");
    expect(total).toBe(1_750_000);
  });

  it("pages through every row before totalling", async () => {
    const full = Array.from({ length: 1000 }, () => ({ credits_deducted: 1 }));
    const builder: Record<string, ReturnType<typeof vi.fn>> & {
      then?: (resolve: (v: unknown) => void) => void;
    } = {} as never;
    for (const m of ["select", "eq", "gte", "lt"]) builder[m] = vi.fn().mockReturnValue(builder);
    builder.range = vi
      .fn()
      .mockReturnValueOnce({ then: (r: (v: unknown) => void) => r({ data: full, error: null }) })
      .mockReturnValueOnce({
        then: (r: (v: unknown) => void) => r({ data: [{ credits_deducted: 5 }], error: null }),
      });
    vi.mocked(supabase.from).mockReturnValue(builder as never);

    const total = await sumCreditsDeducted({
      accountId: "acc_1",
      createdAfter: "2026-08-01T00:00:00Z",
    });

    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(builder.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(total).toBe(1005);
  });

  it("throws on a query error so a caller never reports zero as fact", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: null, error: { message: "boom" } });
    await expect(
      sumCreditsDeducted({ accountId: "acc_1", createdAfter: "2026-08-01T00:00:00Z" }),
    ).rejects.toEqual({ message: "boom" });
  });
});
