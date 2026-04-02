import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

vi.mock("../callElevenLabsMusic", () => ({
  callElevenLabsMusic: vi.fn(),
}));

import { createPlanHandler } from "../createPlanHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { callElevenLabsMusic } from "../callElevenLabsMusic";

describe("createPlanHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns composition plan JSON on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-account",
      orgId: null,
      authToken: "test-token",
    });

    vi.mocked(safeParseJson).mockResolvedValue({ prompt: "cinematic piece" });

    const planData = {
      positive_global_styles: ["pop", "upbeat"],
      negative_global_styles: ["metal"],
      sections: [{ title: "Verse 1", lyrics: "Hello world" }],
    };

    vi.mocked(callElevenLabsMusic).mockResolvedValue(
      new Response(JSON.stringify(planData), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const request = new NextRequest("http://localhost/api/music/plan", {
      method: "POST",
      body: JSON.stringify({ prompt: "cinematic piece" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createPlanHandler(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.positive_global_styles).toEqual(["pop", "upbeat"]);
  });

  it("returns 400 when prompt is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-account",
      orgId: null,
      authToken: "test-token",
    });

    vi.mocked(safeParseJson).mockResolvedValue({});

    const request = new NextRequest("http://localhost/api/music/plan", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createPlanHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns 401 on missing auth", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/music/plan", {
      method: "POST",
      body: JSON.stringify({ prompt: "test" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await createPlanHandler(request);
    expect(response.status).toBe(401);
  });
});
