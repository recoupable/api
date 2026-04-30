import { describe, it, expect, vi, afterEach } from "vitest";

describe("lib/stripe/client", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("throws when STRIPE_SK is not set", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/stripe/client");
    const saved = process.env.STRIPE_SK;
    delete process.env.STRIPE_SK;
    await expect(import("@/lib/stripe/client")).rejects.toThrow(
      "STRIPE_SK environment variable is required",
    );
    process.env.STRIPE_SK = saved;
  });

  it("loads a Stripe client when STRIPE_SK is set", async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/stripe/client");
    const saved = process.env.STRIPE_SK;
    process.env.STRIPE_SK = "stripe_test_key_placeholder";
    const mod = await import("@/lib/stripe/client");
    expect(mod.default).toBeDefined();
    process.env.STRIPE_SK = saved;
  });
});
