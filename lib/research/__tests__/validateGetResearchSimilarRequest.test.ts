import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetResearchSimilarRequest } from "../validateGetResearchSimilarRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("validateGetResearchSimilarRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "acc_1" } as never);
  });

  it("defaults each axis to 'medium' when omitted", async () => {
    const result = await validateGetResearchSimilarRequest(
      new NextRequest("http://x/?artist=Drake"),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      artist: "Drake",
      audience: "medium",
      genre: "medium",
      mood: "medium",
      musicality: "medium",
      limit: undefined,
    });
  });

  it("accepts explicit axis values", async () => {
    const result = await validateGetResearchSimilarRequest(
      new NextRequest(
        "http://x/?artist=Drake&audience=high&genre=low&mood=medium&musicality=high&limit=10",
      ),
    );
    expect(result).toEqual({
      accountId: "acc_1",
      artist: "Drake",
      audience: "high",
      genre: "low",
      mood: "medium",
      musicality: "high",
      limit: "10",
    });
  });

  it("returns 400 when an axis is not high|medium|low", async () => {
    const result = await validateGetResearchSimilarRequest(
      new NextRequest("http://x/?artist=Drake&audience=extreme"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(400);
      const body = await result.json();
      expect(body.error).toContain("audience");
    }
  });
});
