import { describe, it, expect } from "vitest";
import { createCheckoutBodySchema } from "../createCheckoutSchemas";

describe("createCheckoutBodySchema", () => {
  it("accepts plan + successUrl with an optional cancelUrl", () => {
    expect(
      createCheckoutBodySchema.safeParse({
        plan: "starter",
        successUrl: "https://app.example.com/?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "https://example.com/pricing",
      }).success,
    ).toBe(true);
  });

  it("rejects non-http schemes on both redirect fields", () => {
    expect(
      createCheckoutBodySchema.safeParse({ plan: "pro", successUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      createCheckoutBodySchema.safeParse({
        plan: "pro",
        successUrl: "https://x.com",
        cancelUrl: "ftp://x.com",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown plans, missing successUrl, and extra keys", () => {
    expect(
      createCheckoutBodySchema.safeParse({ plan: "gold", successUrl: "https://x.com" }).success,
    ).toBe(false);
    expect(createCheckoutBodySchema.safeParse({ plan: "pro" }).success).toBe(false);
    expect(
      createCheckoutBodySchema.safeParse({
        plan: "pro",
        successUrl: "https://x.com",
        accountId: "a",
      }).success,
    ).toBe(false);
  });
});
