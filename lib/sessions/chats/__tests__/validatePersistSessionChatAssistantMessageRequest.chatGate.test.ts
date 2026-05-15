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
const msg = { message: { id: "m", role: "assistant" as const, parts: [] } };

function authedReq() {
  return new NextRequest("http://x/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
}

describe("validatePersistSessionChatAssistantMessageRequest — chat gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when chat does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([]);
    const res = await validatePersistSessionChatAssistantMessageRequest(
      authedReq(),
      "sess_1",
      "chat_x",
    );
    expect((res as NextResponse).status).toBe(404);
    expect(await (res as NextResponse).json()).toEqual({
      status: "error",
      error: "Chat not found",
    });
  });

  it("returns 404 when chat belongs to another session", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({ id: "chat_a", session_id: "sess_OTHER" }),
    ]);
    const res = await validatePersistSessionChatAssistantMessageRequest(
      authedReq(),
      "sess_1",
      "chat_a",
    );
    expect((res as NextResponse).status).toBe(404);
  });
});
