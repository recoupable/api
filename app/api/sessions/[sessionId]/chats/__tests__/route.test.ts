import { describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/getSessionChatsHandler", () => ({
  getSessionChatsHandler: vi.fn(async () => NextResponse.json({ ok: "get" })),
}));
vi.mock("@/lib/sessions/createSessionChatHandler", () => ({
  createSessionChatHandler: vi.fn(async () => NextResponse.json({ ok: "post" })),
}));

const { getSessionChatsHandler } = await import("@/lib/sessions/getSessionChatsHandler");
const { createSessionChatHandler } = await import("@/lib/sessions/createSessionChatHandler");
const { GET, POST, OPTIONS } = await import("../route");

function makeReq(method: "GET" | "POST", body?: unknown): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("OPTIONS /api/sessions/[sessionId]/chats", () => {
  it("returns 200 with CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/sessions/[sessionId]/chats", () => {
  it("delegates to getSessionChatsHandler with the resolved sessionId", async () => {
    const req = makeReq("GET");

    const res = await GET(req, {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });

    expect(res.status).toBe(200);
    expect(getSessionChatsHandler).toHaveBeenCalledWith(req, "sess_1");
  });
});

describe("POST /api/sessions/[sessionId]/chats", () => {
  it("delegates to createSessionChatHandler with the resolved sessionId", async () => {
    const req = makeReq("POST", { id: "chat_1" });

    const res = await POST(req, {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });

    expect(res.status).toBe(200);
    expect(createSessionChatHandler).toHaveBeenCalledWith(req, "sess_1");
  });
});
