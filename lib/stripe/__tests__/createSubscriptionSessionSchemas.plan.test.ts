import { describe, expect, it } from "vitest";
import { createSubscriptionSessionBodySchema } from "@/lib/stripe/createSubscriptionSessionSchemas";

describe("createSubscriptionSessionBodySchema plan", () => {
  it("accepts starter and pro, defaults to pro", () => {
    const url = "https://chat.recoupable.com/done";
    expect(
      createSubscriptionSessionBodySchema.parse({ successUrl: url, plan: "starter" }).plan,
    ).toBe("starter");
    expect(createSubscriptionSessionBodySchema.parse({ successUrl: url, plan: "pro" }).plan).toBe(
      "pro",
    );
    expect(createSubscriptionSessionBodySchema.parse({ successUrl: url }).plan).toBe("pro");
  });

  it("rejects an unknown plan", () => {
    expect(
      createSubscriptionSessionBodySchema.safeParse({ successUrl: "https://x.y/z", plan: "gold" })
        .success,
    ).toBe(false);
  });
});
