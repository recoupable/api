import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

import { validateVideoToMusicBody } from "../validateVideoToMusicBody";

describe("validateVideoToMusicBody", () => {
  it("accepts valid body with description and tags", () => {
    const result = validateVideoToMusicBody({
      description: "energetic background music",
      tags: ["upbeat", "electronic"],
    });
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("accepts empty body (all fields are optional)", () => {
    const result = validateVideoToMusicBody({});
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("rejects tags exceeding 10 items", () => {
    const result = validateVideoToMusicBody({
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("rejects description exceeding 1000 chars", () => {
    const result = validateVideoToMusicBody({ description: "x".repeat(1001) });
    expect(result).toBeInstanceOf(NextResponse);
  });
});
