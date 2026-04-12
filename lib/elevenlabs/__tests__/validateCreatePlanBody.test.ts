import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

import { validateCreatePlanBody } from "../validateCreatePlanBody";

describe("validateCreatePlanBody", () => {
  it("accepts valid body with prompt", () => {
    const result = validateCreatePlanBody({ prompt: "cinematic orchestral piece, 3 minutes" });
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as Record<string, unknown>).prompt).toBe("cinematic orchestral piece, 3 minutes");
  });

  it("rejects missing prompt", () => {
    const result = validateCreatePlanBody({});
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("rejects music_length_ms out of range", () => {
    const result = validateCreatePlanBody({ prompt: "test", music_length_ms: 999999 });
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("accepts optional source_composition_plan", () => {
    const result = validateCreatePlanBody({
      prompt: "make it more upbeat",
      source_composition_plan: {
        positive_global_styles: ["pop"],
        negative_global_styles: [],
        sections: [{ title: "Intro" }],
      },
    });
    expect(result).not.toBeInstanceOf(NextResponse);
  });
});
