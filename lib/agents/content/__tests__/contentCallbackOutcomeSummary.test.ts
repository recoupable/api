import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleContentAgentCallback } from "../handleContentAgentCallback";
import { getThread } from "@/lib/agents/getThread";

vi.mock("@/lib/agents/getThread", () => ({ getThread: vi.fn() }));

const failed = { runId: "failed-1", status: "failed", error: "Synthetic failure" };
const timedOut = { runId: "timeout-1", status: "timeout" };

function request(results?: unknown[], status = "completed", message?: string) {
  return new Request("https://example.test/api/content-agent/callback", {
    method: "POST",
    headers: { "x-callback-secret": "synthetic-secret" },
    body: JSON.stringify({ threadId: "slack:synthetic:thread", status, results, message }),
  });
}

describe("content callback outcome counts with the actual validator and media helper", () => {
  let thread: {
    state: Promise<{ status: string }>;
    post: ReturnType<typeof vi.fn>;
    setState: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CODING_AGENT_CALLBACK_SECRET", "synthetic-secret");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected synthetic fetch")));
    thread = {
      state: Promise.resolve({ status: "running" }),
      post: vi.fn().mockResolvedValue(undefined),
      setState: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getThread).mockReturnValue(thread as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    {
      results: [failed, { ...failed, runId: "failed-2" }],
      summary: "2 run(s) failed",
    },
    {
      results: [timedOut, { ...timedOut, runId: "timeout-2" }],
      summary: "2 run(s) timed out",
    },
    { results: [failed, timedOut], summary: "1 run(s) failed, 1 run(s) timed out" },
  ])("reports $summary when no video was produced", async ({ results, summary }) => {
    const response = await handleContentAgentCallback(request(results));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(thread.post).toHaveBeenCalledExactlyOnceWith(
      `Content generation finished but no videos were produced (${summary}).`,
    );
    expect(thread.setState).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
    expect(thread.setState.mock.invocationCallOrder[0]).toBeGreaterThan(
      thread.post.mock.invocationCallOrder[0],
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "posts one mixed failure/timeout summary after media (with image: %j)",
    async withImage => {
      const video = {
        runId: "completed-1",
        status: "completed",
        videoUrl: "https://media.example.test/video.mp4",
        captionText: "Synthetic caption",
        ...(withImage ? { imageUrl: "https://media.example.test/editorial.jpg" } : {}),
      };
      vi.mocked(fetch).mockImplementation(async url => {
        if (url === video.videoUrl) {
          return new Response(new Uint8Array([2]), {
            headers: { "content-type": "video/mp4" },
          });
        }
        if (withImage && url === video.imageUrl) {
          return new Response(new Uint8Array([1]), {
            headers: { "content-type": "image/jpeg" },
          });
        }
        throw new Error("Unexpected synthetic URL");
      });

      const response = await handleContentAgentCallback(request([video, failed, timedOut]));

      expect(response.status).toBe(200);
      expect(fetch).toHaveBeenCalledTimes(withImage ? 2 : 1);
      expect(thread.post).toHaveBeenCalledTimes(withImage ? 3 : 2);
      if (withImage) {
        expect(thread.post).toHaveBeenNthCalledWith(1, {
          markdown: "**Editorial Image**",
          files: [{ data: Buffer.from([1]), filename: "editorial.jpg", mimeType: "image/jpeg" }],
        });
      }
      expect(thread.post).toHaveBeenNthCalledWith(withImage ? 2 : 1, {
        markdown: "> Synthetic caption",
        files: [{ data: Buffer.from([2]), filename: "video.mp4", mimeType: "video/mp4" }],
      });
      expect(thread.post).toHaveBeenLastCalledWith("_1 run(s) failed, 1 run(s) timed out._");
      expect(thread.setState).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
      expect(thread.setState.mock.invocationCallOrder[0]).toBeGreaterThan(
        thread.post.mock.invocationCallOrder.at(-1)!,
      );
    },
  );

  it.each([
    { results: undefined },
    { results: [] },
    { results: [{ runId: "empty-completed", status: "completed" }] },
  ])("preserves the no-output control for %j", async ({ results }) => {
    await handleContentAgentCallback(request(results));

    expect(thread.post).toHaveBeenCalledExactlyOnceWith(
      "Content generation finished but no videos were produced.",
    );
    expect(thread.setState).toHaveBeenCalledExactlyOnceWith({ status: "completed" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["completed", "failed", "timeout"])(
    "skips terminal %s thread callbacks without media, summaries or state writes",
    async status => {
      thread.state = Promise.resolve({ status });

      const response = await handleContentAgentCallback(request([failed, timedOut]));

      expect(await response.json()).toEqual({ status: "ok", skipped: true });
      expect(thread.post).not.toHaveBeenCalled();
      expect(thread.setState).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("rejects an unsupported per-run status before thread lookup", async () => {
    const response = await handleContentAgentCallback(
      request([{ runId: "invalid", status: "running" }]),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      status: "error",
      missing_fields: ["results", 0, "status"],
    });
    expect(getThread).not.toHaveBeenCalled();
    expect(thread.post).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { status: "failed", expected: "Content generation failed: Synthetic top-level failure" },
    {
      status: "timeout",
      expected:
        "Content generation timed out after 30 minutes. The pipeline may still be running — check the Trigger.dev dashboard.",
    },
  ])("preserves the top-level $status callback", async ({ status, expected }) => {
    await handleContentAgentCallback(
      request([failed, timedOut], status, "Synthetic top-level failure"),
    );

    expect(thread.post).toHaveBeenCalledExactlyOnceWith(expected);
    expect(thread.setState).toHaveBeenCalledExactlyOnceWith({ status });
    expect(fetch).not.toHaveBeenCalled();
  });
});
