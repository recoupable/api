import { describe, it, expect, vi, beforeEach } from "vitest";
import { claimAutoTopUpLease } from "@/lib/supabase/credits_usage/claimAutoTopUpLease";

const chain = vi.hoisted(() => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["update", "eq", "not", "lt", "or", "select"]) c[name] = vi.fn(() => c);
  c.maybeSingle = vi.fn();
  return c;
});

vi.mock("@/lib/supabase/serverClient", () => ({
  default: { from: vi.fn(() => chain) },
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const NOW = new Date("2026-09-04T15:00:00Z");
const params = {
  accountId: ACCOUNT,
  now: NOW,
  amountCredits: 100_000_000,
  thresholdCredits: 1_000_000,
};

beforeEach(() => vi.clearAllMocks());

describe("claimAutoTopUpLease", () => {
  it("stamps last_run_at in one conditional update that re-checks every setting and the balance", async () => {
    chain.maybeSingle.mockResolvedValue({ data: { auto_topup_amount: 100_000_000 }, error: null });

    const lease = await claimAutoTopUpLease(params);

    expect(lease).toEqual({ stamp: "2026-09-04T15:00:00.000Z", amountCredits: 100_000_000 });
    expect(chain.update).toHaveBeenCalledWith({
      auto_topup_last_run_at: "2026-09-04T15:00:00.000Z",
    });
    expect(chain.eq).toHaveBeenCalledWith("account_id", ACCOUNT);
    expect(chain.eq).toHaveBeenCalledWith("auto_topup_enabled", true);
    expect(chain.eq).toHaveBeenCalledWith("auto_topup_amount", 100_000_000);
    expect(chain.not).toHaveBeenCalledWith("auto_topup_threshold", "is", null);
    expect(chain.lt).toHaveBeenCalledWith("remaining_credits", 1_000_000);
    expect(chain.or).toHaveBeenCalledWith(
      "auto_topup_last_run_at.is.null,auto_topup_last_run_at.lt.2026-09-04T14:50:00.000Z",
    );
    expect(chain.select).toHaveBeenCalledWith("auto_topup_amount");
  });

  it("returns null when no row matched (lease held, settings changed, or balance recovered)", async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await claimAutoTopUpLease(params)).toBeNull();
  });

  it("throws on a database error", async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(claimAutoTopUpLease(params)).rejects.toBeTruthy();
  });
});
