import { describe, it, expect } from "vitest";

import { buildInsufficientCreditsResponse } from "@/lib/credits/buildInsufficientCreditsResponse";
import { CREDIT_BILLING_URL } from "@/lib/credits/const";

describe("buildInsufficientCreditsResponse", () => {
  it("returns the 402 envelope with a static billingUrl", () => {
    expect(
      buildInsufficientCreditsResponse({ remainingCredits: 12, requiredCredits: 100 }),
    ).toEqual({
      error: "insufficient_credits",
      remaining_credits: 12,
      required_credits: 100,
      billingUrl: CREDIT_BILLING_URL,
    });
  });

  it("carries no checkoutUrl and no declineReason", () => {
    const body = buildInsufficientCreditsResponse({ remainingCredits: 0, requiredCredits: 5 });

    expect(body).not.toHaveProperty("checkoutUrl");
    expect(body).not.toHaveProperty("declineReason");
  });

  // A constant is the whole point: a caller that retries the gate must get the
  // same URL back rather than a freshly minted Stripe object each time.
  it("returns an identical billingUrl on every call", () => {
    const a = buildInsufficientCreditsResponse({ remainingCredits: 0, requiredCredits: 1 });
    const b = buildInsufficientCreditsResponse({ remainingCredits: 3, requiredCredits: 9 });

    expect(a.billingUrl).toBe(b.billingUrl);
  });

  it("points at the Recoup app rather than a Stripe host", () => {
    const { billingUrl } = buildInsufficientCreditsResponse({
      remainingCredits: 0,
      requiredCredits: 1,
    });

    expect(billingUrl).toBe("https://app.recoupable.dev");
    expect(billingUrl).not.toContain("stripe");
  });
});
