import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

import { validateComposeBody } from "../validateComposeBody";

describe("validateComposeBody", () => {
  it("accepts valid prompt-only body", () => {
    const result = validateComposeBody({ prompt: "upbeat pop song about summer" });
    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as Record<string, unknown>).prompt).toBe("upbeat pop song about summer");
  });

  it("accepts valid composition_plan-only body", () => {
    const plan = {
      positive_global_styles: ["pop"],
      negative_global_styles: ["metal"],
      sections: [{ title: "Verse 1" }],
    };
    const result = validateComposeBody({ composition_plan: plan });
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("rejects when both prompt and composition_plan are provided", () => {
    const result = validateComposeBody({
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
    const result = validateComposeBody({});
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("rejects prompt exceeding 4100 characters", () => {
    const result = validateComposeBody({ prompt: "x".repeat(4101) });
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("rejects music_length_ms out of range", () => {
    const result = validateComposeBody({ prompt: "test", music_length_ms: 1000 });
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("accepts valid output_format", () => {
    const result = validateComposeBody({ prompt: "test", output_format: "mp3_44100_128" });
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("rejects invalid output_format", () => {
    const result = validateComposeBody({ prompt: "test", output_format: "invalid_format" });
    expect(result).toBeInstanceOf(NextResponse);
  });
});
