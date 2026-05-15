import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { selectSessions } = await import("@/lib/supabase/sessions/selectSessions");
const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { validatePersistSessionChatAssistantMessageRequest } = await import(
  "@/lib/sessions/chats/validatePersistSessionChatAssistantMessageRequest"
);

const accountId = "acc-uuid-1";

function prepAuthedChat() {
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "tok",
  });
  vi.mocked(selectSessions).mockResolvedValue([
    baseSessionRow({ id: "sess_1", account_id: accountId }),
  ]);
  vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_a", session_id: "sess_1" })]);
}

describe("validatePersistSessionChatAssistantMessageRequest — JSON/body", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 Invalid JSON body when JSON is malformed", async () => {
    prepAuthedChat();
    const req = new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_a/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await validatePersistSessionChatAssistantMessageRequest(req, "sess_1", "chat_a");
    expect(await (res as NextResponse).json()).toEqual({ error: "Invalid JSON body" });
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when wrapper has unknown keys (strict)", async () => {
    prepAuthedChat();
    const req = new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_a/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { id: "msg_1", role: "assistant", parts: [] },
        extra: 1,
      }),
    });
    const res = await validatePersistSessionChatAssistantMessageRequest(req, "sess_1", "chat_a");
    expect(await (res as NextResponse).json()).toEqual({
      error: "A valid assistant message is required",
    });
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns validated message on success", async () => {
    prepAuthedChat();
    const req = new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_a/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { id: "msg_1", role: "assistant", parts: [{ type: "text", text: "hi" }] },
      }),
    });
    const res = await validatePersistSessionChatAssistantMessageRequest(req, "sess_1", "chat_a");
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res.message.parts).toEqual([{ type: "text", text: "hi" }]);
      expect(res.message.role).toBe("assistant");
      expect(res.message.id).toBe("msg_1");
    }
  });
});
