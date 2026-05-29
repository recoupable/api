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
const { validateGetChatRequest } = await import("@/lib/chats/validateGetChatRequest");

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/chats/chat_1");
}

describe("validateGetChatRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the auth NextResponse when validateAuthContext rejects", async () => {
    const failure = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const res = await validateGetChatRequest(makeReq(), "chat_1");
    expect(res).toBe(failure);
    expect(selectChats).not.toHaveBeenCalled();
    expect(selectSessions).not.toHaveBeenCalled();
  });

  it("returns 404 when the chat is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "tok" });
    vi.mocked(selectChats).mockResolvedValue([]);

    const res = await validateGetChatRequest(makeReq(), "chat_missing");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
    }
    expect(selectSessions).not.toHaveBeenCalled();
  });

  it("returns 403 when the chat's session belongs to another account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "tok" });
    vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_1", session_id: "sess_1" })]);
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: "someone-else" }),
    ]);

    const res = await validateGetChatRequest(makeReq(), "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(403);
    }
  });

  it("returns 403 when the chat's session is missing (orphan)", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "tok" });
    vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_1", session_id: "sess_1" })]);
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await validateGetChatRequest(makeReq(), "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(403);
    }
  });

  it("returns the chat row when the caller owns its session", async () => {
    const chat = baseChatRow({ id: "chat_1", session_id: "sess_1" });
    vi.mocked(validateAuthContext).mockResolvedValue({ accountId, orgId: null, authToken: "tok" });
    vi.mocked(selectChats).mockResolvedValue([chat]);
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);

    const res = await validateGetChatRequest(makeReq(), "chat_1");
    expect(res).toEqual(chat);
    expect(selectChats).toHaveBeenCalledWith({ id: "chat_1" });
    expect(selectSessions).toHaveBeenCalledWith({ id: "sess_1" });
  });
});
