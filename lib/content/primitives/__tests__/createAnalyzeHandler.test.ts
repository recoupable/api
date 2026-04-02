import { beforeEach, describe, expect, it, vi } from "vitest";
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

const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { safeParseJson } = await import("@/lib/networking/safeParseJson");
const { createAnalyzeHandler } = await import("../createAnalyzeHandler");

const VALID_BODY = {
  video_url: "https://example.com/video.mp4",
  prompt: "Describe what happens in this video",
};

describe("createAnalyzeHandler", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, TWELVELABS_API_KEY: "test-key" };
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(safeParseJson).mockResolvedValue(VALID_BODY);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns auth error when auth fails", async () => {
    const authError = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authError);

    const request = new NextRequest("http://localhost/api/content/analyze-video", {
      method: "POST",
    });
    const result = await createAnalyzeHandler(request);

    expect(result.status).toBe(401);
  });

  it("returns 500 when TWELVELABS_API_KEY is missing", async () => {
    delete process.env.TWELVELABS_API_KEY;

    const request = new NextRequest("http://localhost/api/content/analyze-video", {
      method: "POST",
    });
    const result = await createAnalyzeHandler(request);

    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body.error).toContain("TWELVELABS_API_KEY");
  });

  it("returns analysis text on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: "This video shows a cat playing piano.",
          finish_reason: "stop",
          usage: { output_tokens: 42 },
        }),
        { status: 200 },
      ),
    );

    const request = new NextRequest("http://localhost/api/content/analyze-video", {
      method: "POST",
    });
    const result = await createAnalyzeHandler(request);

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.text).toBe("This video shows a cat playing piano.");
    expect(body.finish_reason).toBe("stop");
    expect(body.usage).toEqual({ output_tokens: 42 });
  });

  it("returns 502 when Twelve Labs returns an error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("Bad Request", { status: 400 }));

    const request = new NextRequest("http://localhost/api/content/analyze-video", {
      method: "POST",
    });
    const result = await createAnalyzeHandler(request);

    expect(result.status).toBe(502);
    const body = await result.json();
    expect(body.error).toContain("400");
  });

  it("returns 502 when response has no data", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    const request = new NextRequest("http://localhost/api/content/analyze-video", {
      method: "POST",
    });
    const result = await createAnalyzeHandler(request);

    expect(result.status).toBe(502);
    const body = await result.json();
    expect(body.error).toContain("no text");
  });

  it("sends correct body to Twelve Labs API", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: "result", finish_reason: "stop", usage: { output_tokens: 10 } }),
          { status: 200 },
        ),
      );

    const request = new NextRequest("http://localhost/api/content/analyze-video", {
      method: "POST",
    });
    await createAnalyzeHandler(request);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.twelvelabs.io/v1.3/analyze");
    const sentBody = JSON.parse(options?.body as string);
    expect(sentBody.video).toEqual({ type: "url", url: "https://example.com/video.mp4" });
    expect(sentBody.prompt).toBe("Describe what happens in this video");
    expect(sentBody.stream).toBe(false);
    expect(sentBody.temperature).toBe(0.2);
  });
});
