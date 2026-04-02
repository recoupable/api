import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

import { validateStemSeparationBody } from "../validateStemSeparationBody";

describe("validateStemSeparationBody", () => {
  it("accepts valid body with stem_variation_id", () => {
    const result = validateStemSeparationBody({ stem_variation_id: "two_stems_v1" });
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as Record<string, unknown>).stem_variation_id).toBe("two_stems_v1");
  });

  it("defaults stem_variation_id to six_stems_v1", () => {
    const result = validateStemSeparationBody({});
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as Record<string, unknown>).stem_variation_id).toBe("six_stems_v1");
  });

  it("rejects invalid stem_variation_id", () => {
    const result = validateStemSeparationBody({ stem_variation_id: "invalid" });
    expect(result).toBeInstanceOf(NextResponse);
  });
});
