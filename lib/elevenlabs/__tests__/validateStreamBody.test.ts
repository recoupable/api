import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

import { validateStreamBody } from "../validateStreamBody";

describe("validateStreamBody", () => {
  it("accepts valid prompt-only body", () => {
    const result = validateStreamBody({ prompt: "lo-fi hip hop beats" });
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("rejects when both prompt and composition_plan are provided", () => {
    const result = validateStreamBody({
      prompt: "test",
      composition_plan: {
        positive_global_styles: [],
        negative_global_styles: [],
        sections: [{ title: "V1" }],
      },
    });
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("rejects when neither prompt nor composition_plan is provided", () => {
    const result = validateStreamBody({});
    expect(result).toBeInstanceOf(NextResponse);
  });
});
