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
});
