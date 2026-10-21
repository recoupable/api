import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleContentAgentCallback } from "../handleContentAgentCallback";
import { getThread } from "@/lib/agents/getThread";

vi.mock("@/lib/agents/getThread", () => ({ getThread: vi.fn() }));
const body = {
  threadId: "slack:C1:T1",
  status: "completed",
  results: [
    {
      runId: "r1",
      status: "completed",
      videoUrl: "https://cdn.example.com/video.mp4",
      imageUrl: "https://cdn.example.com/image.jpg",
      captionText: "fixture caption",
    },
    { runId: "r2", status: "failed", error: "fixture failed" },
  ],
};
function request(payload: unknown = body, secret = "fixture-secret") {
  return new Request("https://example.com/api/content-agent/callback", {
    method: "POST",
    headers: { "x-callback-secret": secret },
    body: JSON.stringify(payload),
  });
}
describe("actual content callback validation and media posting with fake transport/thread", () => {
  let thread: {
    state: Promise<{ status: string }>;
    post: ReturnType<typeof vi.fn>;
    setState: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CODING_AGENT_CALLBACK_SECRET", "fixture-secret");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected fixture fetch"));
    thread = {
      state: Promise.resolve({ status: "running" }),
      post: vi.fn().mockResolvedValue(undefined),
      setState: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getThread).mockReturnValue(thread as never);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("retains imageUrl through validation and posts image, video, then failure count", async () => {
    const transport = vi.spyOn(globalThis, "fetch").mockImplementation(async url => {
      if (url === "https://cdn.example.com/image.jpg")
        return new Response(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } });
      if (url === "https://cdn.example.com/video.mp4")
        return new Response(new Uint8Array([2]), { headers: { "content-type": "video/mp4" } });
      throw new Error("unexpected fixture URL");
    });
    expect((await handleContentAgentCallback(request())).status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(thread.post).toHaveBeenNthCalledWith(1, {
      markdown: "**Editorial Image**",
      files: [{ data: Buffer.from([1]), filename: "image.jpg", mimeType: "image/jpeg" }],
    });
    expect(thread.post).toHaveBeenNthCalledWith(2, {
      markdown: "> fixture caption",
      files: [{ data: Buffer.from([2]), filename: "video.mp4", mimeType: "video/mp4" }],
    });
    expect(thread.post).toHaveBeenNthCalledWith(3, "_1 run(s) failed._");
    expect(thread.setState).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
  });
  it("rejects unauthorized callbacks before thread lookup or media access", async () => {
    const transport = vi.spyOn(globalThis, "fetch");
    expect((await handleContentAgentCallback(request(body, "wrong-fixture-secret"))).status).toBe(
      401,
    );
    expect(getThread).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });
  it("skips terminal thread retries without media reads or posts", async () => {
    const transport = vi.spyOn(globalThis, "fetch");
    thread.state = Promise.resolve({ status: "completed" });
    const response = await handleContentAgentCallback(request());
    expect(await response.json()).toEqual({ status: "ok", skipped: true });
    expect(transport).not.toHaveBeenCalled();
    expect(thread.post).not.toHaveBeenCalled();
  });
  it("preserves validation error body/status/CORS for invalid imageUrl type", async () => {
    const response = await handleContentAgentCallback(
      request({ ...body, results: [{ ...body.results[0], imageUrl: 42 }] }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      status: "error",
      error: expect.any(String),
      missing_fields: ["results", 0, "imageUrl"],
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(getThread).not.toHaveBeenCalled();
  });
});
