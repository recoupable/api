import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateStopChatWorkflowRequest } from "@/lib/chat/validateStopChatWorkflowRequest";
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
const SESSION_ID = "22222222-2222-2222-2222-222222222222";
const CHAT_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/chat/" + CHAT_ID + "/stop", {
    method: "POST",
    headers: { "x-api-key": "test-key" },
  });
}

function mockAuth() {
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: ACCOUNT_ID,
    orgId: null,
    authToken: "token",
  });
}

const chatRow = {
  id: CHAT_ID,
  session_id: SESSION_ID,
  active_stream_id: "wrun_123",
  model_id: null,
} as never;

const sessionRow = { id: SESSION_ID, account_id: ACCOUNT_ID } as never;

describe("validateStopChatWorkflowRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth context + chat when ownership checks pass", async () => {
    mockAuth();
    vi.mocked(selectChats).mockResolvedValue([chatRow]);
    vi.mocked(selectSessions).mockResolvedValue([sessionRow]);

    const result = await validateStopChatWorkflowRequest(makeRequest(), CHAT_ID);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) throw new Error("unexpected error response");
    expect(result.auth.accountId).toBe(ACCOUNT_ID);
    expect(result.chat.id).toBe(CHAT_ID);
    expect(vi.mocked(selectChats)).toHaveBeenCalledWith({ id: CHAT_ID });
    expect(vi.mocked(selectSessions)).toHaveBeenCalledWith({ id: SESSION_ID });
  });

  it("passes through the auth NextResponse on authentication failure", async () => {
    const unauthorized = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(unauthorized);

    const result = await validateStopChatWorkflowRequest(makeRequest(), CHAT_ID);

    expect(result).toBe(unauthorized);
    expect(vi.mocked(selectChats)).not.toHaveBeenCalled();
  });

  it("returns 400 when chatId is not a valid UUID", async () => {
    mockAuth();

    const result = await validateStopChatWorkflowRequest(makeRequest(), "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(vi.mocked(selectChats)).not.toHaveBeenCalled();
  });

  it("returns 404 when the chat does not exist", async () => {
    mockAuth();
    vi.mocked(selectChats).mockResolvedValue([]);

    const result = await validateStopChatWorkflowRequest(makeRequest(), CHAT_ID);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
    expect(vi.mocked(selectSessions)).not.toHaveBeenCalled();
  });

  it("returns 500 when the session lookup hits a DB error", async () => {
    mockAuth();
    vi.mocked(selectChats).mockResolvedValue([chatRow]);
    vi.mocked(selectSessions).mockResolvedValue(null);

    const result = await validateStopChatWorkflowRequest(makeRequest(), CHAT_ID);

    expect((result as NextResponse).status).toBe(500);
  });

  it("returns 404 when the parent session is missing", async () => {
    mockAuth();
    vi.mocked(selectChats).mockResolvedValue([chatRow]);
    vi.mocked(selectSessions).mockResolvedValue([]);

    const result = await validateStopChatWorkflowRequest(makeRequest(), CHAT_ID);

    expect((result as NextResponse).status).toBe(404);
  });

  it("returns 403 when the chat is owned by another account", async () => {
    mockAuth();
    vi.mocked(selectChats).mockResolvedValue([chatRow]);
    vi.mocked(selectSessions).mockResolvedValue([
      { id: SESSION_ID, account_id: OTHER_ACCOUNT_ID } as never,
    ]);

    const result = await validateStopChatWorkflowRequest(makeRequest(), CHAT_ID);

    expect((result as NextResponse).status).toBe(403);
  });
});
