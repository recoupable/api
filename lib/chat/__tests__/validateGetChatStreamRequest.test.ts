import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateGetChatStreamRequest } from "@/lib/chat/validateGetChatStreamRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_ACCOUNT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const CHAT_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/chat/${CHAT_ID}/stream`, {
    method: "GET",
    headers: { "x-api-key": "test-key" },
  });
}

function mockAuthed() {
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: ACCOUNT_ID,
    orgId: null,
    authToken: "test-key",
  });
}

beforeEach(() => vi.clearAllMocks());

describe("validateGetChatStreamRequest", () => {
  it("returns 400 when chatId is empty", async () => {
    const res = await validateGetChatStreamRequest(makeRequest(), "");
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(400);
  });

  it("returns 400 when chatId is not a valid UUID", async () => {
    const res = await validateGetChatStreamRequest(makeRequest(), "not-a-uuid");
    expect((res as NextResponse).status).toBe(400);
  });

  it("passes through the auth error response", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );
    const res = await validateGetChatStreamRequest(makeRequest(), CHAT_ID);
    expect((res as NextResponse).status).toBe(401);
  });

  it("returns 404 when the chat does not exist", async () => {
    mockAuthed();
    vi.mocked(selectChats).mockResolvedValue([]);
    const res = await validateGetChatStreamRequest(makeRequest(), CHAT_ID);
    expect((res as NextResponse).status).toBe(404);
  });

  it("returns 500 when the chat lookup errors (selectChats null)", async () => {
    mockAuthed();
    vi.mocked(selectChats).mockResolvedValue(null);
    const res = await validateGetChatStreamRequest(makeRequest(), CHAT_ID);
    expect((res as NextResponse).status).toBe(500);
  });

  it("returns 500 when the session lookup errors", async () => {
    mockAuthed();
    vi.mocked(selectChats).mockResolvedValue([{ id: CHAT_ID, session_id: SESSION_ID } as never]);
    vi.mocked(selectSessions).mockResolvedValue(null);
    const res = await validateGetChatStreamRequest(makeRequest(), CHAT_ID);
    expect((res as NextResponse).status).toBe(500);
  });

  it("returns 404 when the session does not exist", async () => {
    mockAuthed();
    vi.mocked(selectChats).mockResolvedValue([{ id: CHAT_ID, session_id: SESSION_ID } as never]);
    vi.mocked(selectSessions).mockResolvedValue([]);
    const res = await validateGetChatStreamRequest(makeRequest(), CHAT_ID);
    expect((res as NextResponse).status).toBe(404);
  });

  it("returns 403 when the caller does not own the session", async () => {
    mockAuthed();
    vi.mocked(selectChats).mockResolvedValue([{ id: CHAT_ID, session_id: SESSION_ID } as never]);
    vi.mocked(selectSessions).mockResolvedValue([
      { id: SESSION_ID, account_id: OTHER_ACCOUNT_ID } as never,
    ]);
    const res = await validateGetChatStreamRequest(makeRequest(), CHAT_ID);
    expect((res as NextResponse).status).toBe(403);
  });

  it("returns the chat row when the caller owns it", async () => {
    mockAuthed();
    vi.mocked(selectChats).mockResolvedValue([
      { id: CHAT_ID, session_id: SESSION_ID, active_stream_id: "wrun_x" } as never,
    ]);
    vi.mocked(selectSessions).mockResolvedValue([
      { id: SESSION_ID, account_id: ACCOUNT_ID } as never,
    ]);
    const res = await validateGetChatStreamRequest(makeRequest(), CHAT_ID);
    expect(res).not.toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) return;
    expect(res.chat.id).toBe(CHAT_ID);
    expect(res.accountId).toBe(ACCOUNT_ID);
  });
});
