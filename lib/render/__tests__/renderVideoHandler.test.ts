import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { renderVideoHandler } from "@/lib/render/renderVideoHandler";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateRenderVideoBody } from "@/lib/render/validateRenderVideoBody";
import { triggerRenderVideo } from "@/lib/trigger/triggerRenderVideo";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/render/validateRenderVideoBody", () => ({
  validateRenderVideoBody: vi.fn(),
}));

vi.mock("@/lib/trigger/triggerRenderVideo", () => ({
  triggerRenderVideo: vi.fn(),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

describe("renderVideoHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when authentication fails", async () => {
    const errorResponse = NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 },
    );
    vi.mocked(validateAuthContext).mockResolvedValue(errorResponse);

    const request = new NextRequest("http://localhost/api/video/render", {
      method: "POST",
      body: JSON.stringify({ compositionId: "SocialPost" }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await renderVideoHandler(request);

    expect(result).toBe(errorResponse);
  });

  it("returns validation error when body validation fails", async () => {
    // Auth passes
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-account-id",
      orgId: null,
      authToken: "test-token",
    });

    const errorResponse = NextResponse.json(
      { status: "error", error: "compositionId is required" },
      { status: 400 },
    );
    vi.mocked(validateRenderVideoBody).mockReturnValue(errorResponse);

    const request = new NextRequest("http://localhost/api/video/render", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const result = await renderVideoHandler(request);

    expect(result).toBe(errorResponse);
  });

  it("returns processing status with runId on success", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-account-id",
      orgId: null,
      authToken: "test-token",
    });

    vi.mocked(validateRenderVideoBody).mockReturnValue({
      compositionId: "SocialPost",
      inputProps: { videoUrl: "https://example.com/video.mp4" },
      width: 720,
      height: 1280,
      fps: 30,
      durationInFrames: 240,
      codec: "h264",
    });

    vi.mocked(triggerRenderVideo).mockResolvedValue({
      id: "run_render_abc123",
    } as never);

    const request = new NextRequest("http://localhost/api/video/render", {
      method: "POST",
      body: JSON.stringify({ compositionId: "SocialPost" }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await renderVideoHandler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body).toEqual({
      status: "processing",
      runId: "run_render_abc123",
    });
  });

  it("passes accountId to triggerRenderVideo", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "my-account-id",
      orgId: null,
      authToken: "test-token",
    });

    vi.mocked(validateRenderVideoBody).mockReturnValue({
      compositionId: "SocialPost",
      inputProps: {},
      width: 720,
      height: 1280,
      fps: 30,
      durationInFrames: 240,
      codec: "h264",
    });

    vi.mocked(triggerRenderVideo).mockResolvedValue({
      id: "run_123",
    } as never);

    const request = new NextRequest("http://localhost/api/video/render", {
      method: "POST",
      body: JSON.stringify({ compositionId: "SocialPost" }),
      headers: { "Content-Type": "application/json" },
    });

    await renderVideoHandler(request);

    expect(triggerRenderVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "my-account-id",
        compositionId: "SocialPost",
      }),
    );
  });

  it("returns 500 when trigger fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "test-account-id",
      orgId: null,
      authToken: "test-token",
    });

    vi.mocked(validateRenderVideoBody).mockReturnValue({
      compositionId: "SocialPost",
      inputProps: {},
      width: 720,
      height: 1280,
      fps: 30,
      durationInFrames: 240,
      codec: "h264",
    });

    vi.mocked(triggerRenderVideo).mockRejectedValue(new Error("Trigger.dev connection failed"));

    const request = new NextRequest("http://localhost/api/video/render", {
      method: "POST",
      body: JSON.stringify({ compositionId: "SocialPost" }),
      headers: { "Content-Type": "application/json" },
    });

    const result = await renderVideoHandler(request);
    const body = await result.json();

    expect(result.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Trigger.dev connection failed",
    });
  });
});
