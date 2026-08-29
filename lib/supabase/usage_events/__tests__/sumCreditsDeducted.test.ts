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

  it("returns 0 on a query error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: null, error: { message: "boom" } });
    expect(
      await sumCreditsDeducted({ accountId: "acc_1", createdAfter: "2026-08-01T00:00:00Z" }),
    ).toBe(0);
  });
});
