import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "node:crypto";

vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return {
    ...actual,
    after: vi.fn((fn: () => void) => fn()),
  };
});

const mockInitialize = vi.fn();
const mockSlackWebhook = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

vi.mock("@/lib/coding-agent/bot", () => ({
  codingAgentBot: {
    initialize: mockInitialize,
    webhooks: {
      slack: mockSlackWebhook,
    },
  },
}));

vi.mock("@/lib/coding-agent/handlers/registerHandlers", () => ({}));

const { GET, POST } = await import("../[platform]/route");

const SLACK_SIGNING_SECRET = "test_signing_secret";
const SLACK_BOT_TOKEN = "xoxb-test-token";

/**
 * Generates a valid Slack request signature for testing.
 *
 * @param body - The raw request body string
 * @param timestamp - The Unix timestamp string
 * @param secret - The Slack signing secret
 * @returns The computed v0 HMAC-SHA256 signature string
 */
function makeSlackSignature(body: string, timestamp: string, secret = SLACK_SIGNING_SECRET) {
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", secret).update(baseString).digest("hex");
  return `v0=${hmac}`;
}

/**
 * Creates a NextRequest with valid Slack signature headers.
 *
 * @param body - The raw request body string
 * @param overrides - Optional header overrides for testing invalid scenarios
 * @param overrides.signature - Override the x-slack-signature header
 * @param overrides.timestamp - Override the x-slack-request-timestamp header
 * @returns A NextRequest with Slack signature headers
 */
function makeSlackRequest(body: string, overrides?: { signature?: string; timestamp?: string }) {
  const timestamp = overrides?.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = overrides?.signature ?? makeSlackSignature(body, timestamp);

  return new NextRequest("https://example.com/api/coding-agent/slack", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-slack-signature": signature,
      "x-slack-request-timestamp": timestamp,
    },
  });
}

describe("GET /api/coding-agent/[platform]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to platform webhook handler", async () => {
    const request = new NextRequest("https://example.com/api/coding-agent/slack", {
      method: "GET",
    });

    const response = await GET(request, { params: Promise.resolve({ platform: "slack" }) });

    expect(response.status).toBe(200);
    expect(mockSlackWebhook).toHaveBeenCalled();
  });

  it("returns 404 for unknown platforms", async () => {
    const request = new NextRequest("https://example.com/api/coding-agent/unknown", {
      method: "GET",
    });

    const response = await GET(request, { params: Promise.resolve({ platform: "unknown" }) });

    expect(response.status).toBe(404);
  });

  it("does not call initialize for GET requests", async () => {
    const request = new NextRequest("https://example.com/api/coding-agent/slack", {
      method: "GET",
    });

    await GET(request, { params: Promise.resolve({ platform: "slack" }) });

    expect(mockInitialize).not.toHaveBeenCalled();
  });
});

describe("POST /api/coding-agent/[platform]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SLACK_SIGNING_SECRET", SLACK_SIGNING_SECRET);
    vi.stubEnv("SLACK_BOT_TOKEN", SLACK_BOT_TOKEN);
  });

  it("responds to Slack url_verification challenge with valid signature", async () => {
    const body = JSON.stringify({
      type: "url_verification",
      challenge: "test_challenge_value",
    });

    const request = makeSlackRequest(body);

    const response = await POST(request, {
      params: Promise.resolve({ platform: "slack" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.challenge).toBe("test_challenge_value");
  });

  it("returns 401 for url_verification with invalid signature", async () => {
    const body = JSON.stringify({
      type: "url_verification",
      challenge: "test_challenge_value",
    });

    const request = makeSlackRequest(body, { signature: "v0=invalidsignature" });

    const response = await POST(request, {
      params: Promise.resolve({ platform: "slack" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 401 for url_verification with missing signature headers", async () => {
    const body = JSON.stringify({
      type: "url_verification",
      challenge: "test_challenge_value",
    });

    const request = new NextRequest("https://example.com/api/coding-agent/slack", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, {
      params: Promise.resolve({ platform: "slack" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 401 for url_verification with stale timestamp", async () => {
    const body = JSON.stringify({
      type: "url_verification",
      challenge: "test_challenge_value",
    });

    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 400);
    const request = makeSlackRequest(body, { timestamp: staleTimestamp });

    const response = await POST(request, {
      params: Promise.resolve({ platform: "slack" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 401 for url_verification with malformed (non-integer) timestamp", async () => {
    const body = JSON.stringify({
      type: "url_verification",
      challenge: "test_challenge_value",
    });

    // "123abc" would be silently truncated to 123 by parseInt but is rejected by Number()+isInteger()
    const request = makeSlackRequest(body, { timestamp: "123abc" });

    const response = await POST(request, {
      params: Promise.resolve({ platform: "slack" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 for unknown platforms without initializing", async () => {
    const request = new NextRequest("https://example.com/api/coding-agent/unknown", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, {
      params: Promise.resolve({ platform: "unknown" }),
    });

    expect(response.status).toBe(404);
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  it("delegates non-challenge Slack requests to bot webhook handler", async () => {
    const body = JSON.stringify({
      type: "event_callback",
      event: { type: "app_mention", text: "hello" },
    });

    const request = makeSlackRequest(body);

    const response = await POST(request, {
      params: Promise.resolve({ platform: "slack" }),
    });

    expect(response.status).toBe(200);
    expect(mockSlackWebhook).toHaveBeenCalled();
  });

  it("calls initialize before delegating to webhook handler", async () => {
    const callOrder: string[] = [];
    mockInitialize.mockImplementation(async () => {
      callOrder.push("initialize");
    });
    mockSlackWebhook.mockImplementation(async () => {
      callOrder.push("webhook");
      return new Response("ok", { status: 200 });
    });

    const body = JSON.stringify({
      type: "event_callback",
      event: { type: "app_mention", text: "hello" },
    });

    const request = makeSlackRequest(body);

    await POST(request, {
      params: Promise.resolve({ platform: "slack" }),
    });

    expect(callOrder).toEqual(["initialize", "webhook"]);
  });

  it("does not call initialize for url_verification challenges", async () => {
    const body = JSON.stringify({
      type: "url_verification",
      challenge: "test_challenge",
    });

    const request = makeSlackRequest(body);

    await POST(request, {
      params: Promise.resolve({ platform: "slack" }),
    });

    expect(mockInitialize).not.toHaveBeenCalled();
  });
});
