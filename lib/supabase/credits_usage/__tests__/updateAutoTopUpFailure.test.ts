import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateAutoTopUpFailure } from "@/lib/supabase/credits_usage/updateAutoTopUpFailure";

const { eq, update } = vi.hoisted(() => ({ eq: vi.fn(), update: vi.fn() }));

vi.mock("@/lib/supabase/serverClient", () => ({
  default: { from: vi.fn(() => ({ update })) },
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  vi.clearAllMocks();
  update.mockReturnValue({ eq });
});

describe("updateAutoTopUpFailure", () => {
  it("turns auto top-up off and stores the decline message", async () => {
    eq.mockResolvedValue({ error: null });

    await updateAutoTopUpFailure({ accountId: ACCOUNT, message: "Your card was declined." });

    expect(update).toHaveBeenCalledWith({
      auto_topup_enabled: false,
      auto_topup_last_error: "Your card was declined.",
    });
    expect(eq).toHaveBeenCalledWith("account_id", ACCOUNT);
  });

  it("throws on a database error", async () => {
    eq.mockResolvedValue({ error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(updateAutoTopUpFailure({ accountId: ACCOUNT, message: "x" })).rejects.toBeTruthy();
  });
});
