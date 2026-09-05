import { describe, it, expect, vi, beforeEach } from "vitest";
import { disableAutoTopUpAfterFailure } from "@/lib/credits/disableAutoTopUpAfterFailure";
import { readAutoTopUpSettings } from "@/lib/billing/readAutoTopUpSettings";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { sendAutoTopUpEmail } from "@/lib/credits/sendAutoTopUpEmail";

vi.mock("@/lib/billing/readAutoTopUpSettings", () => ({ readAutoTopUpSettings: vi.fn() }));
vi.mock("@/lib/supabase/credits_usage/updateCreditsUsage", () => ({ updateCreditsUsage: vi.fn() }));
vi.mock("@/lib/credits/sendAutoTopUpEmail", () => ({ sendAutoTopUpEmail: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const STAMP = "2026-09-05T12:00:00.000Z";
const params = {
  accountId: ACCOUNT,
  amountCents: 500,
  message: "Your card was declined.",
  stamp: STAMP,
};

describe("disableAutoTopUpAfterFailure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables, records the reason, and emails when the stamp is still ours", async () => {
    vi.mocked(readAutoTopUpSettings).mockResolvedValue({ auto_topup_last_run_at: STAMP } as never);
    const out = await disableAutoTopUpAfterFailure(params);
    expect(updateCreditsUsage).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      updates: { auto_topup_enabled: false, auto_topup_last_error: "Your card was declined." },
    });
    expect(sendAutoTopUpEmail).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      kind: "declined",
      amountCents: 500,
      message: "Your card was declined.",
    });
    expect(out).toEqual({ kind: "disabled", message: "Your card was declined." });
  });

  it("leaves newer settings alone when another run has stamped since", async () => {
    vi.mocked(readAutoTopUpSettings).mockResolvedValue({
      auto_topup_last_run_at: "2026-09-05T12:30:00.000Z",
    } as never);
    const out = await disableAutoTopUpAfterFailure(params);
    expect(updateCreditsUsage).not.toHaveBeenCalled();
    expect(sendAutoTopUpEmail).not.toHaveBeenCalled();
    expect(out).toEqual({ kind: "skipped" });
  });
});
