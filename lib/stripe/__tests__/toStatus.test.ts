import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { toStatus } from "@/lib/stripe/toStatus";

describe("toStatus", () => {
  it.each([["active"], ["trialing"], ["canceled"], ["past_due"]] as const)(
    "passes through supported Stripe status %s",
    status => {
      expect(toStatus(status as Stripe.Subscription.Status)).toBe(status);
    },
  );

  it.each([["incomplete"], ["incomplete_expired"], ["unpaid"], ["paused"]] as const)(
    "normalizes unsupported status %s to 'none'",
    status => {
      expect(toStatus(status as Stripe.Subscription.Status)).toBe("none");
    },
  );
});
