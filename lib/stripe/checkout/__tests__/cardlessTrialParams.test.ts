import { describe, it, expect, vi, afterEach } from "vitest";

describe("cardlessTrialParams", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is empty unless STRIPE_CARDLESS_TRIAL is exactly 'true'", async () => {
    vi.stubEnv("STRIPE_CARDLESS_TRIAL", "");
    const { cardlessTrialParams } = await import("../cardlessTrialParams");
    expect(cardlessTrialParams(30)).toEqual({});
    expect(cardlessTrialParams(undefined)).toEqual({});
  });

  it("skips the card field and ends the trial to Free when enabled and a trial exists", async () => {
    vi.stubEnv("STRIPE_CARDLESS_TRIAL", "true");
    vi.resetModules();
    const { cardlessTrialParams } = await import("../cardlessTrialParams");
    expect(cardlessTrialParams(30)).toEqual({
      payment_method_collection: "if_required",
      subscription_data: {
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      },
    });
    expect(cardlessTrialParams(undefined)).toEqual({});
  });
});
