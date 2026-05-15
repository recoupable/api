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

function makeReq(
  body: unknown,
  url = "https://example.com/api/sessions/sess_1/chats/chat_a/messages",
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function authedSessionAndChat() {
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

describe("validatePersistSessionChatAssistantMessageRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "nope" }, { status: 401 }),
    );

    const res = await validatePersistSessionChatAssistantMessageRequest(
      makeReq({ message: validMessage() }),
      "sess_1",
      "chat_a",
    );
    expect(res).toBeInstanceOf(NextResponse);
    expect((res as NextResponse).status).toBe(401);
  });

  it("returns 404 when session does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await validatePersistSessionChatAssistantMessageRequest(
      makeReq({ message: validMessage() }),
      "sess_missing",
      "chat_a",
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ status: "error", error: "Session not found" });
    }
  });

  it("returns 403 when session is owned by a different account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: "acc-OTHER" }),
    ]);

    const res = await validatePersistSessionChatAssistantMessageRequest(
      makeReq({ message: validMessage() }),
      "sess_1",
      "chat_a",
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(403);
    }
  });

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
      makeReq({ message: validMessage() }),
      "sess_1",
      "chat_missing",
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ status: "error", error: "Chat not found" });
    }
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
      makeReq({ message: validMessage() }),
      "sess_1",
      "chat_a",
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
    }
  });

  it("returns 400 Invalid JSON body when JSON is malformed", async () => {
    authedSessionAndChat();

    const res = await validatePersistSessionChatAssistantMessageRequest(
      makeReq("{not-json"),
      "sess_1",
      "chat_a",
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid JSON body" });
    }
  });

  it("returns 400 when wrapper has unknown keys (strict)", async () => {
    authedSessionAndChat();

    const res = await validatePersistSessionChatAssistantMessageRequest(
      makeReq({ message: validMessage(), extra: 1 }),
      "sess_1",
      "chat_a",
    );
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "A valid assistant message is required" });
    }
  });

  it("returns validated message on success", async () => {
    authedSessionAndChat();

    const res = await validatePersistSessionChatAssistantMessageRequest(
      makeReq({ message: validMessage({ parts: [{ type: "text", text: "hi" }] }) }),
      "sess_1",
      "chat_a",
    );
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res.message.id).toBe("msg_1");
      expect(res.message.role).toBe("assistant");
      expect(res.message.parts).toEqual([{ type: "text", text: "hi" }]);
    }
  });
});

function validMessage(overrides: Partial<{ id: string; parts: unknown[] }> = {}) {
  return {
    id: overrides.id ?? "msg_1",
    role: "assistant" as const,
    parts: overrides.parts ?? [],
  };
}
