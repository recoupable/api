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

vi.mock("../downloadVideoBuffer", () => ({
  downloadVideoBuffer: vi.fn(),
}));

const { validateContentAgentCallback } = await import("../validateContentAgentCallback");
const { getThread } = await import("@/lib/agents/getThread");
const { downloadVideoBuffer } = await import("../downloadVideoBuffer");

const mockedValidate = vi.mocked(validateContentAgentCallback);
const mockedGetThread = vi.mocked(getThread);
const mockedDownload = vi.mocked(downloadVideoBuffer);

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
     * Creates a Request with a valid auth header for testing.
     *
     * @param body - The request body to serialize as JSON
     * @returns A Request instance with valid auth headers
     */
    function makeAuthRequest(body: object) {
      return new Request("http://localhost/api/content-agent/callback", {
        method: "POST",
        headers: { "x-callback-secret": "test-secret" },
        body: JSON.stringify(body),
      });
    }

    /**
     * Creates a mock thread with post, state, and setState.
     *
     * @returns A mock thread object
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

    it("posts video as file upload when download succeeds", async () => {
      const thread = mockThread();
      const videoData = Buffer.from([0x00, 0x00, 0x00, 0x1c]);
      mockedDownload.mockResolvedValue(videoData);
      mockedValidate.mockReturnValue({
        threadId: "slack:C123:T456",
        status: "completed",
        results: [
          {
            runId: "run-1",
            status: "completed",
            videoUrl: "https://cdn.example.com/video.mp4",
            captionText: "Test caption",
          },
        ],
      });

      const response = await handleContentAgentCallback(makeAuthRequest({}));

      expect(response.status).toBe(200);
      expect(mockedDownload).toHaveBeenCalledWith("https://cdn.example.com/video.mp4");
      expect(thread.post).toHaveBeenCalledWith(
        expect.objectContaining({
          markdown: expect.stringContaining("Test caption"),
          files: [
            expect.objectContaining({
              data: videoData,
              filename: "video.mp4",
              mimeType: "video/mp4",
            }),
          ],
        }),
      );
    });

    it("falls back to posting video URL when download fails", async () => {
      const thread = mockThread();
      mockedDownload.mockResolvedValue(null);
      mockedValidate.mockReturnValue({
        threadId: "slack:C123:T456",
        status: "completed",
        results: [
          {
            runId: "run-1",
            status: "completed",
            videoUrl: "https://cdn.example.com/video.mp4",
          },
        ],
      });

      const response = await handleContentAgentCallback(makeAuthRequest({}));

      expect(response.status).toBe(200);
      expect(thread.post).toHaveBeenCalledWith(
        expect.stringContaining("https://cdn.example.com/video.mp4"),
      );
    });

    it("handles multiple videos with individual file uploads", async () => {
      const thread = mockThread();
      const videoData1 = Buffer.from([0x01]);
      const videoData2 = Buffer.from([0x02]);
      mockedDownload.mockResolvedValueOnce(videoData1).mockResolvedValueOnce(videoData2);
      mockedValidate.mockReturnValue({
        threadId: "slack:C123:T456",
        status: "completed",
        results: [
          { runId: "run-1", status: "completed", videoUrl: "https://cdn.example.com/video1.mp4" },
          { runId: "run-2", status: "completed", videoUrl: "https://cdn.example.com/video2.mp4" },
        ],
      });

      const response = await handleContentAgentCallback(makeAuthRequest({}));

      expect(response.status).toBe(200);
      expect(thread.post).toHaveBeenCalledTimes(2);
    });

    it("posts without caption when captionText is absent", async () => {
      const thread = mockThread();
      const videoData = Buffer.from([0x01]);
      mockedDownload.mockResolvedValue(videoData);
      mockedValidate.mockReturnValue({
        threadId: "slack:C123:T456",
        status: "completed",
        results: [
          { runId: "run-1", status: "completed", videoUrl: "https://cdn.example.com/clip.mp4" },
        ],
      });

      const response = await handleContentAgentCallback(makeAuthRequest({}));

      expect(response.status).toBe(200);
      expect(thread.post).toHaveBeenCalledWith(
        expect.objectContaining({
          files: [expect.objectContaining({ filename: "clip.mp4" })],
        }),
      );
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

    it("appends failed run count when some runs fail", async () => {
      const thread = mockThread();
      const videoData = Buffer.from([0x01]);
      mockedDownload.mockResolvedValue(videoData);
      mockedValidate.mockReturnValue({
        threadId: "slack:C123:T456",
        status: "completed",
        results: [
          { runId: "run-1", status: "completed", videoUrl: "https://cdn.example.com/video.mp4" },
          { runId: "run-2", status: "failed", error: "render error" },
        ],
      });

      const response = await handleContentAgentCallback(makeAuthRequest({}));

      expect(response.status).toBe(200);
      // Last post should mention failures
      const lastCall = thread.post.mock.calls[thread.post.mock.calls.length - 1][0];
      expect(typeof lastCall === "string" ? lastCall : "").toContain("failed");
    });
  });
});
