import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleContentAgentCallback } from "../handleContentAgentCallback";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validateContentAgentCallback", () => ({
  validateContentAgentCallback: vi.fn(),
}));

vi.mock("@/lib/agents/getThread", () => ({
  getThread: vi.fn(),
}));

vi.mock("../postVideoResults", () => ({
  postVideoResults: vi.fn().mockResolvedValue(undefined),
}));

const { validateContentAgentCallback } = await import("../validateContentAgentCallback");
const { getThread } = await import("@/lib/agents/getThread");
const { postVideoResults } = await import("../postVideoResults");

const mockedValidate = vi.mocked(validateContentAgentCallback);
const mockedGetThread = vi.mocked(getThread);
const mockedPostVideos = vi.mocked(postVideoResults);

describe("handleContentAgentCallback", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CODING_AGENT_CALLBACK_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 401 when x-callback-secret header is missing", async () => {
    const request = new Request("http://localhost/api/content-agent/callback", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await handleContentAgentCallback(request);
    expect(response.status).toBe(401);
  });

  it("returns 401 when secret does not match CODING_AGENT_CALLBACK_SECRET", async () => {
    const request = new Request("http://localhost/api/content-agent/callback", {
      method: "POST",
      headers: { "x-callback-secret": "wrong-secret" },
      body: JSON.stringify({}),
    });

    const response = await handleContentAgentCallback(request);
    expect(response.status).toBe(401);
  });

  it("returns 401 when CODING_AGENT_CALLBACK_SECRET env var is not set", async () => {
    delete process.env.CODING_AGENT_CALLBACK_SECRET;

    const request = new Request("http://localhost/api/content-agent/callback", {
      method: "POST",
      headers: { "x-callback-secret": "test-secret" },
      body: JSON.stringify({}),
    });

    const response = await handleContentAgentCallback(request);
    expect(response.status).toBe(401);
  });

  it("proceeds past auth when secret matches CODING_AGENT_CALLBACK_SECRET", async () => {
    const request = new Request("http://localhost/api/content-agent/callback", {
      method: "POST",
      headers: { "x-callback-secret": "test-secret" },
      body: "not json",
    });

    const response = await handleContentAgentCallback(request);
    // Should get past auth and fail on invalid JSON (400), not auth (401)
    expect(response.status).toBe(400);
  });

  describe("completed callback with videos", () => {
    /**
     * Make Auth Request.
     *
     * @param body - Request payload.
     * @returns - Computed result.
     */
    function makeAuthRequest(body: object) {
      return new Request("http://localhost/api/content-agent/callback", {
        method: "POST",
        headers: { "x-callback-secret": "test-secret" },
        body: JSON.stringify(body),
      });
    }

    /**
     * Mock Thread.
     *
     * @returns - Computed result.
     */
    function mockThread() {
      const thread = {
        post: vi.fn().mockResolvedValue(undefined),
        state: Promise.resolve({ status: "running" }),
        setState: vi.fn().mockResolvedValue(undefined),
      };
      mockedGetThread.mockReturnValue(thread as never);
      return thread;
    }

    it("calls postVideoResults with videos and failed count", async () => {
      const thread = mockThread();
      mockedValidate.mockReturnValue({
        threadId: "slack:C123:T456",
        status: "completed",
        results: [
          {
            runId: "run-1",
            status: "completed",
            videoUrl: "https://cdn.example.com/video.mp4",
            captionText: "Test",
          },
          { runId: "run-2", status: "failed", error: "render error" },
        ],
      });

      const response = await handleContentAgentCallback(makeAuthRequest({}));

      expect(response.status).toBe(200);
      expect(mockedPostVideos).toHaveBeenCalledWith(
        thread,
        [expect.objectContaining({ videoUrl: "https://cdn.example.com/video.mp4" })],
        1,
      );
    });

    it("posts fallback message when no videos produced", async () => {
      const thread = mockThread();
      mockedValidate.mockReturnValue({
        threadId: "slack:C123:T456",
        status: "completed",
        results: [{ runId: "run-1", status: "failed", error: "render error" }],
      });

      const response = await handleContentAgentCallback(makeAuthRequest({}));

      expect(response.status).toBe(200);
      expect(thread.post).toHaveBeenCalledWith(
        "Content generation finished but no videos were produced.",
      );
      expect(mockedPostVideos).not.toHaveBeenCalled();
    });

    it("skips duplicate delivery when thread status is not running", async () => {
      const thread = {
        post: vi.fn(),
        state: Promise.resolve({ status: "completed" }),
        setState: vi.fn(),
      };
      mockedGetThread.mockReturnValue(thread as never);
      mockedValidate.mockReturnValue({
        threadId: "slack:C123:T456",
        status: "completed",
        results: [],
      });

      const response = await handleContentAgentCallback(makeAuthRequest({}));
      const body = await response.json();

      expect(body.skipped).toBe(true);
      expect(thread.post).not.toHaveBeenCalled();
    });

    it("sets thread state to completed after posting", async () => {
      const thread = mockThread();
      mockedValidate.mockReturnValue({
        threadId: "slack:C123:T456",
        status: "completed",
        results: [
          { runId: "run-1", status: "completed", videoUrl: "https://cdn.example.com/v.mp4" },
        ],
      });

      await handleContentAgentCallback(makeAuthRequest({}));

      expect(thread.setState).toHaveBeenCalledWith({ status: "completed" });
    });
  });
});
