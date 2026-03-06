import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const mockPost = vi.fn();
const mockSetState = vi.fn();

vi.mock("chat", () => {
  const ThreadImpl = vi.fn().mockImplementation(() => ({
    post: mockPost,
    setState: mockSetState,
  }));
  return {
    ThreadImpl,
    deriveChannelId: vi.fn((_, threadId: string) => {
      const parts = threadId.split(":");
      return `${parts[0]}:${parts[1]}`;
    }),
    Card: vi.fn((opts) => ({ type: "card", ...opts })),
    CardText: vi.fn((text) => ({ type: "text", text })),
    Actions: vi.fn((children) => ({ type: "actions", children })),
    Button: vi.fn((opts) => ({ type: "button", ...opts })),
    LinkButton: vi.fn((opts) => ({ type: "link-button", ...opts })),
  };
});

vi.mock("../bot", () => ({
  codingAgentBot: {},
}));

const { handleCodingAgentCallback } = await import("../handleCodingAgentCallback");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CODING_AGENT_CALLBACK_SECRET = "test-secret";
});

describe("handleCodingAgentCallback", () => {
  /**
   *
   * @param body
   * @param secret
   */
  function makeRequest(body: unknown, secret = "test-secret") {
    return {
      json: () => Promise.resolve(body),
      headers: new Headers({
        "x-callback-secret": secret,
      }),
    } as unknown as Request;
  }

  it("returns 401 when secret header is missing", async () => {
    const request = {
      json: () => Promise.resolve({}),
      headers: new Headers(),
    } as unknown as Request;

    const response = await handleCodingAgentCallback(request);
    expect(response.status).toBe(401);
  });

  it("returns 401 when secret header is wrong", async () => {
    const request = makeRequest({}, "wrong-secret");
    const response = await handleCodingAgentCallback(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const request = makeRequest({ invalid: true });
    const response = await handleCodingAgentCallback(request);
    expect(response.status).toBe(400);
  });

  it("posts PR links for pr_created status", async () => {
    const body = {
      threadId: "slack:C123:1234567890.123456",
      status: "pr_created",
      branch: "agent/fix-bug-1234",
      snapshotId: "snap_abc",
      prs: [
        {
          repo: "recoupable/recoup-api",
          number: 42,
          url: "https://github.com/recoupable/recoup-api/pull/42",
          baseBranch: "test",
        },
      ],
    };
    const request = makeRequest(body);

    const response = await handleCodingAgentCallback(request);

    expect(response.status).toBe(200);
    expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({ card: expect.anything() }));
    expect(mockSetState).toHaveBeenCalledWith(expect.objectContaining({ status: "pr_created" }));
  });

  it("posts no-changes message and resets state for no_changes status", async () => {
    const body = {
      threadId: "slack:C123:1234567890.123456",
      status: "no_changes",
      message: "No files modified",
    };
    const request = makeRequest(body);

    const response = await handleCodingAgentCallback(request);

    expect(response.status).toBe(200);
    expect(mockSetState).toHaveBeenCalledWith(expect.objectContaining({ status: "no_changes" }));
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("No changes"));
  });

  it("posts error message and resets state for failed status", async () => {
    const body = {
      threadId: "slack:C123:1234567890.123456",
      status: "failed",
      message: "Sandbox timed out",
    };
    const request = makeRequest(body);

    const response = await handleCodingAgentCallback(request);

    expect(response.status).toBe(200);
    expect(mockSetState).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("Sandbox timed out"));
  });

  it("posts updated confirmation for updated status", async () => {
    const body = {
      threadId: "slack:C123:1234567890.123456",
      status: "updated",
      snapshotId: "snap_new",
    };
    const request = makeRequest(body);

    const response = await handleCodingAgentCallback(request);

    expect(response.status).toBe(200);
    expect(mockSetState).toHaveBeenCalledWith(expect.objectContaining({ snapshotId: "snap_new" }));
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("updated"));
  });
});
