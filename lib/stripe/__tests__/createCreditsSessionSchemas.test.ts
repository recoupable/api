import { describe, it, expect } from "vitest";
import { createCreditsSessionBodySchema } from "@/lib/stripe/createCreditsSessionSchemas";

describe("createCreditsSessionBodySchema", () => {
  it("requires successUrl", () => {
    const r = createCreditsSessionBodySchema.safeParse({ credits: 100 });
    expect(r.success).toBe(false);
  });

  it("rejects invalid URL", () => {
    const r = createCreditsSessionBodySchema.safeParse({
      successUrl: "not-a-url",
      credits: 100,
    });
    expect(r.success).toBe(false);
  });

  it("requires credits", () => {
    const r = createCreditsSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer credits", () => {
    const r = createCreditsSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
      credits: 12.5,
    });
    expect(r.success).toBe(false);
  });

  it("rejects credits < 1", () => {
    const r = createCreditsSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
      credits: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative credits", () => {
    const r = createCreditsSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
      credits: -10,
    });
    expect(r.success).toBe(false);
  });

  it("accepts successUrl + credits", () => {
    const r = createCreditsSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
      credits: 250,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        successUrl: "https://chat.recoupable.com/done",
        credits: 250,
      });
    }
  });

  it("accepts optional accountId UUID", () => {
    const r = createCreditsSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
      credits: 250,
      accountId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed accountId", () => {
    const r = createCreditsSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
      credits: 250,
      accountId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    const r = createCreditsSessionBodySchema.safeParse({
      successUrl: "https://chat.recoupable.com/done",
      credits: 250,
      extra: true,
    });
    expect(r.success).toBe(false);
  });
});
