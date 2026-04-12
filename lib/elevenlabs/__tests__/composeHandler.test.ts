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

import { composeHandler } from "../composeHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { callElevenLabsMusic } from "../callElevenLabsMusic";

describe("composeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns audio with correct content-type on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-account",
      orgId: null,
      authToken: "test-token",
    });

    vi.mocked(safeParseJson).mockResolvedValue({ prompt: "upbeat pop song" });

    vi.mocked(callElevenLabsMusic).mockResolvedValue(
      new Response("audio-bytes", {
        status: 200,
        headers: {
          "content-type": "audio/mpeg",
          "song-id": "song-123",
        },
      }),
    );

    const request = new NextRequest("http://localhost/api/music/compose", {
      method: "POST",
      body: JSON.stringify({ prompt: "upbeat pop song" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await composeHandler(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("song-id")).toBe("song-123");
  });

  it("returns 400 on invalid body", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-account",
      orgId: null,
      authToken: "test-token",
    });

    vi.mocked(safeParseJson).mockResolvedValue({});

    const request = new NextRequest("http://localhost/api/music/compose", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await composeHandler(request);
    expect(response.status).toBe(400);
  });

  it("returns 401 on missing auth", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/music/compose", {
      method: "POST",
      body: JSON.stringify({ prompt: "test" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await composeHandler(request);
    expect(response.status).toBe(401);
  });

  it("returns 502 when ElevenLabs returns 500", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-account",
      orgId: null,
      authToken: "test-token",
    });

    vi.mocked(safeParseJson).mockResolvedValue({ prompt: "test" });

    vi.mocked(callElevenLabsMusic).mockResolvedValue(
      new Response("Internal error", { status: 500 }),
    );

    const request = new NextRequest("http://localhost/api/music/compose", {
      method: "POST",
      body: JSON.stringify({ prompt: "test" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await composeHandler(request);
    expect(response.status).toBe(502);
  });
});
