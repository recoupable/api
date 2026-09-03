import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const { createImageBodySchema } = await import("../validateCreateImageBody");

describe("createImageBodySchema", () => {
  it("rejects an explicitly empty prompt", () => {
    const result = createImageBodySchema.safeParse({ prompt: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a non-empty prompt", () => {
    const result = createImageBodySchema.safeParse({ prompt: "a neon skyline" });
    expect(result.success).toBe(true);
  });

  it("still allows an omitted prompt", () => {
    const result = createImageBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
