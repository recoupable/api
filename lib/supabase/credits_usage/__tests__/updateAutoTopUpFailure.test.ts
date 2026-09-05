import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { updateAutoTopUpFailure } from "@/lib/supabase/credits_usage/updateAutoTopUpFailure";

const chain = vi.hoisted(() => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["update", "eq", "select"]) c[name] = vi.fn(() => c);
  c.maybeSingle = vi.fn();
  return c;
});

vi.mock("@/lib/supabase/serverClient", () => ({
  default: { from: vi.fn(() => chain) },
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("updateAutoTopUpFailure", () => {
  it("turns auto top-up off, stores the decline message, and reads the row back", async () => {
    chain.maybeSingle.mockResolvedValue({ data: { account_id: ACCOUNT }, error: null });

    await updateAutoTopUpFailure({ accountId: ACCOUNT, message: "Your card was declined." });

    expect(chain.update).toHaveBeenCalledWith({
      auto_topup_enabled: false,
      auto_topup_last_error: "Your card was declined.",
    });
    expect(chain.eq).toHaveBeenCalledWith("account_id", ACCOUNT);
    expect(chain.select).toHaveBeenCalledWith("account_id");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs when no credits_usage row matched so a silent no-op is visible", async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    await updateAutoTopUpFailure({ accountId: ACCOUNT, message: "x" });
    expect(console.error).toHaveBeenCalledWith(
      `[updateAutoTopUpFailure] no credits_usage row for ${ACCOUNT}`,
    );
  });

  it("throws on a database error", async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(updateAutoTopUpFailure({ accountId: ACCOUNT, message: "x" })).rejects.toBeTruthy();
  });
});
