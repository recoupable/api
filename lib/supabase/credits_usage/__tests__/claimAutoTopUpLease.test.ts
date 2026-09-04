import { describe, it, expect, vi, beforeEach } from "vitest";
import { claimAutoTopUpLease } from "@/lib/supabase/credits_usage/claimAutoTopUpLease";

const { maybeSingle, update, eq, or } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const select = vi.fn(() => ({ maybeSingle }));
  const or = vi.fn(() => ({ select }));
  const eq = vi.fn();
  const update = vi.fn();
  return { maybeSingle, update, eq, or, select };
});

vi.mock("@/lib/supabase/serverClient", () => ({
  default: { from: vi.fn(() => ({ update })) },
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const NOW = new Date("2026-09-04T15:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  eq.mockReturnValue({ eq, or });
  update.mockReturnValue({ eq });
});

describe("claimAutoTopUpLease", () => {
  it("stamps last_run_at only when enabled and outside the 10-minute window, returning the stamp", async () => {
    maybeSingle.mockResolvedValue({ data: { account_id: ACCOUNT }, error: null });

    const lease = await claimAutoTopUpLease({ accountId: ACCOUNT, now: NOW });

    expect(lease).toBe("2026-09-04T15:00:00.000Z");
    expect(update).toHaveBeenCalledWith({ auto_topup_last_run_at: "2026-09-04T15:00:00.000Z" });
    expect(eq).toHaveBeenCalledWith("account_id", ACCOUNT);
    expect(eq).toHaveBeenCalledWith("auto_topup_enabled", true);
    expect(or).toHaveBeenCalledWith(
      "auto_topup_last_run_at.is.null,auto_topup_last_run_at.lt.2026-09-04T14:50:00.000Z",
    );
  });

  it("returns null when no row matched (another deduction already holds the lease)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await claimAutoTopUpLease({ accountId: ACCOUNT, now: NOW })).toBeNull();
  });

  it("throws on a database error", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(claimAutoTopUpLease({ accountId: ACCOUNT, now: NOW })).rejects.toBeTruthy();
  });
});
