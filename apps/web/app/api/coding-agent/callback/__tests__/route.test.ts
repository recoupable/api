import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockInitialize = vi.fn();
const mockHandleCallback = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));

vi.mock("@/lib/coding-agent/bot", () => ({
  codingAgentBot: {
    initialize: mockInitialize,
  },
}));

vi.mock("@/lib/coding-agent/handleCodingAgentCallback", () => ({
  handleCodingAgentCallback: mockHandleCallback,
}));

const { POST } = await import("../route");

describe("POST /api/coding-agent/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls codingAgentBot.initialize() before handling the callback", async () => {
    const request = new NextRequest("https://example.com/api/coding-agent/callback", {
      method: "POST",
      body: JSON.stringify({ threadId: "slack:C123:ts", status: "pr_created" }),
      headers: { "content-type": "application/json" },
    });

    await POST(request);

    expect(mockInitialize).toHaveBeenCalledTimes(1);
    expect(mockHandleCallback).toHaveBeenCalledWith(request);
  });

  it("calls initialize before handleCodingAgentCallback", async () => {
    const callOrder: string[] = [];
    mockInitialize.mockImplementation(async () => {
      callOrder.push("initialize");
    });
    mockHandleCallback.mockImplementation(async () => {
      callOrder.push("handleCallback");
      return new Response("ok", { status: 200 });
    });

    const request = new NextRequest("https://example.com/api/coding-agent/callback", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    await POST(request);

    expect(callOrder).toEqual(["initialize", "handleCallback"]);
  });

  it("returns the response from handleCodingAgentCallback", async () => {
    const expectedResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    mockHandleCallback.mockResolvedValue(expectedResponse);

    const request = new NextRequest("https://example.com/api/coding-agent/callback", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response).toBe(expectedResponse);
  });
});
