import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/chats/validateGetChatRequest", () => ({
  validateGetChatRequest: vi.fn(),
}));

const { validateGetChatRequest } = await import("@/lib/chats/validateGetChatRequest");
const { getChatHandler } = await import("@/lib/chats/getChatHandler");

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/chats/chat_1");
}

describe("getChatHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the validation NextResponse on failure", async () => {
    const failure = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(validateGetChatRequest).mockResolvedValue(failure);

    const res = await getChatHandler(makeReq(), "chat_1");
    expect(res).toBe(failure);
  });

  it("returns 200 with the camelCase chat (incl. sessionId) on success", async () => {
    vi.mocked(validateGetChatRequest).mockResolvedValue(
      baseChatRow({ id: "chat_1", session_id: "sess_1", title: "My chat" }),
    );

    const res = await getChatHandler(makeReq(), "chat_1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chat).toMatchObject({ id: "chat_1", sessionId: "sess_1", title: "My chat" });
  });
});
