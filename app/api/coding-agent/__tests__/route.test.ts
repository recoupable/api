import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return {
    ...actual,
    after: vi.fn((fn: () => void) => fn()),
  };
});

vi.mock("@/lib/coding-agent/bot", () => ({
  codingAgentBot: {
    webhooks: {
      slack: vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
      github: vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
    },
  },
}));

vi.mock("@/lib/coding-agent/handlers/registerHandlers", () => ({}));

const { POST } = await import("../[platform]/route");

describe("POST /api/coding-agent/[platform]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds to Slack url_verification challenge without loading bot", async () => {
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

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.challenge).toBe("test_challenge_value");
  });

  it("returns 404 for unknown platforms", async () => {
    const request = new NextRequest("https://example.com/api/coding-agent/unknown", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, {
      params: Promise.resolve({ platform: "unknown" }),
    });

    expect(response.status).toBe(404);
  });

  it("delegates non-challenge Slack requests to bot webhook handler", async () => {
    const { codingAgentBot } = await import("@/lib/coding-agent/bot");

    const body = JSON.stringify({
      type: "event_callback",
      event: { type: "app_mention", text: "hello" },
    });

    const request = new NextRequest("https://example.com/api/coding-agent/slack", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, {
      params: Promise.resolve({ platform: "slack" }),
    });

    expect(response.status).toBe(200);
    expect(codingAgentBot.webhooks.slack).toHaveBeenCalled();
  });
});
