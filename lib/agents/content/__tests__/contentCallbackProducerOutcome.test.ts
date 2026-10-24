import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getThread } from "@/lib/agents/getThread";
import { handleContentAgentCallback } from "../handleContentAgentCallback";
import { resolveOverallStatus } from "./fixtures/tasks-fcb3a2/resolveOverallStatus";
import type { ContentRunResult } from "./fixtures/tasks-fcb3a2/pollContentRuns";

vi.mock("@/lib/agents/getThread", () => ({ getThread: vi.fn() }));

const failed: ContentRunResult = {
  runId: "failed-1",
  status: "failed",
  error: "Synthetic worker error",
};
const completed: ContentRunResult = {
  runId: "completed-1",
  status: "completed",
  videoUrl: "https://media.example.test/video.mp4",
  imageUrl: "https://media.example.test/image.jpg",
};

function request(results: ContentRunResult[], message?: string) {
  return new Request("https://example.test/api/content-agent/callback", {
    method: "POST",
    headers: { "x-callback-secret": "synthetic-producer-secret" },
    body: JSON.stringify({
      threadId: "slack:synthetic:thread",
      status: resolveOverallStatus(results),
      results,
      ...(message !== undefined ? { message } : {}),
    }),
  });
}

describe("current worker failed-batch notifications", () => {
  let thread: {
    state: Promise<{ status: string }>;
    post: ReturnType<typeof vi.fn>;
    setState: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CODING_AGENT_CALLBACK_SECRET", "synthetic-producer-secret");
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

  it("uses the exact immutable worker resolver fixture", () => {
    const source = readFileSync(
      new URL("./fixtures/tasks-fcb3a2/resolveOverallStatus.ts", import.meta.url),
    );
    expect(createHash("sha256").update(source).digest("hex")).toBe(
      "b90be8f6811eb7bb1f65af1d3dd506c96d37bed31a25fc2da4e08175cb79ecf1",
    );
  });

  it.each([
    {
      label: "all-failed",
      results: [failed, { ...failed, runId: "failed-2" }],
      expected: "Content generation failed: 2 run(s) failed",
    },
    {
      label: "mixed completed/failed",
      results: [completed, failed],
      expected: "Content generation failed: 1 run(s) failed",
    },
  ])(
    "reports known counts for $label without an overall message",
    async ({ results, expected }) => {
      expect(resolveOverallStatus(results)).toBe("failed");

      const response = await handleContentAgentCallback(request(results));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
      expect(thread.setState).toHaveBeenCalledExactlyOnceWith({ status: "failed" });
      expect(thread.post).toHaveBeenCalledExactlyOnceWith(expected);
      expect(thread.setState.mock.invocationCallOrder[0]).toBeLessThan(
        thread.post.mock.invocationCallOrder[0],
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each(["\n  Supplied overall message.\n", ""])(
    "preserves the explicit overall message %j instead of replacing it with counts",
    async message => {
      await handleContentAgentCallback(request([failed], message));

      expect(thread.post).toHaveBeenCalledExactlyOnceWith(`Content generation failed: ${message}`);
      expect(thread.setState).toHaveBeenCalledExactlyOnceWith({ status: "failed" });
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([{ results: undefined }, { results: [] }])(
    "preserves Unknown error for a failed callback with no results: %j",
    async ({ results }) => {
      const response = await handleContentAgentCallback(
        new Request("https://example.test/api/content-agent/callback", {
          method: "POST",
          headers: { "x-callback-secret": "synthetic-producer-secret" },
          body: JSON.stringify({ threadId: "slack:synthetic:thread", status: "failed", results }),
        }),
      );

      expect(response.status).toBe(200);
      expect(thread.post).toHaveBeenCalledExactlyOnceWith(
        "Content generation failed: Unknown error",
      );
      expect(thread.setState).toHaveBeenCalledExactlyOnceWith({ status: "failed" });
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
