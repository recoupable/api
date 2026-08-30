import { describe, it, expect } from "vitest";
import { createSubscriptionSessionBodySchema } from "@/lib/stripe/createSubscriptionSessionSchemas";

describe("createSubscriptionSessionBodySchema", () => {
  it("requires successUrl", () => {
    const r = createSubscriptionSessionBodySchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const r = createSubscriptionSessionBodySchema.safeParse({ successUrl: "not-a-url" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    const r = createSubscriptionSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
      accountId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(false);
  });

  it("defaults plan to pro when omitted", () => {
    const r = createSubscriptionSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        plan: "pro",
        successUrl: "https://chat.recoupable.com/done",
      });
    }
  });

  it("accepts plan, successUrl, and optional cancelUrl", () => {
    const r = createSubscriptionSessionBodySchema.safeParse({
      plan: "starter",
      successUrl: "https://chat.recoupable.com/done",
      cancelUrl: "https://recoupable.dev/pricing",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        plan: "starter",
        successUrl: "https://chat.recoupable.com/done",
        cancelUrl: "https://recoupable.dev/pricing",
      });
    }
  });
});
