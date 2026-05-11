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
vi.mock("@/lib/supabase/chats/insertChat", () => ({
  insertChat: vi.fn(),
}));
vi.mock("@/lib/uuid/generateUUID", () => ({
  generateUUID: vi.fn(() => "generated-uuid"),
}));

const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { selectSessions } = await import("@/lib/supabase/sessions/selectSessions");
const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { insertChat } = await import("@/lib/supabase/chats/insertChat");
const { createSessionChatHandler } = await import("@/lib/sessions/createSessionChatHandler");

const accountId = "acc-uuid-1";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function authedSession() {
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "tok",
  });
  vi.mocked(selectSessions).mockResolvedValue([
    baseSessionRow({ id: "sess_1", account_id: accountId }),
  ]);
}

describe("createSessionChatHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await createSessionChatHandler(makeReq({}), "sess_1");
    expect(res.status).toBe(401);
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("returns 404 when session does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await createSessionChatHandler(makeReq({}), "sess_missing");
    expect(res.status).toBe(404);
    expect(insertChat).not.toHaveBeenCalled();
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

    const res = await createSessionChatHandler(makeReq({}), "sess_1");
    expect(res.status).toBe(403);
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("returns 400 when id is an empty string", async () => {
    authedSession();

    const res = await createSessionChatHandler(makeReq({ id: "" }), "sess_1");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid chat id" });
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("returns 400 when id is not a string", async () => {
    authedSession();

    const res = await createSessionChatHandler(makeReq({ id: 42 }), "sess_1");
    expect(res.status).toBe(400);
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("returns existing chat when requested id already exists in the same session", async () => {
    authedSession();
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({ id: "chat_existing", session_id: "sess_1", title: "Existing" }),
    ]);

    const res = await createSessionChatHandler(makeReq({ id: "chat_existing" }), "sess_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { chat: { id: string; title: string } };
    expect(body.chat.id).toBe("chat_existing");
    expect(body.chat.title).toBe("Existing");
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("returns 409 when requested id exists in a different session", async () => {
    authedSession();
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({ id: "chat_existing", session_id: "sess_OTHER" }),
    ]);

    const res = await createSessionChatHandler(makeReq({ id: "chat_existing" }), "sess_1");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Chat ID conflict" });
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("creates a chat with the requested id when none exists yet", async () => {
    authedSession();
    vi.mocked(selectChats).mockResolvedValue([]);
    vi.mocked(insertChat).mockResolvedValue(
      baseChatRow({ id: "chat_requested", session_id: "sess_1" }),
    );

    const res = await createSessionChatHandler(makeReq({ id: "chat_requested" }), "sess_1");
    expect(res.status).toBe(200);
    const insertArgs = vi.mocked(insertChat).mock.calls[0][0];
    expect(insertArgs.id).toBe("chat_requested");
    expect(insertArgs.session_id).toBe("sess_1");
    expect(insertArgs.title).toBe("New chat");
  });

  it("creates a chat with a generated id when no id is provided", async () => {
    authedSession();
    vi.mocked(insertChat).mockResolvedValue(
      baseChatRow({ id: "generated-uuid", session_id: "sess_1" }),
    );

    const res = await createSessionChatHandler(makeReq({}), "sess_1");
    expect(res.status).toBe(200);
    const insertArgs = vi.mocked(insertChat).mock.calls[0][0];
    expect(insertArgs.id).toBe("generated-uuid");
    expect(insertArgs.title).toBe("New chat");
    expect(selectChats).not.toHaveBeenCalled();
  });

  it("treats malformed JSON like an empty body and creates a new chat", async () => {
    authedSession();
    vi.mocked(insertChat).mockResolvedValue(
      baseChatRow({ id: "generated-uuid", session_id: "sess_1" }),
    );

    const res = await createSessionChatHandler(makeReq("{not json"), "sess_1");
    expect(res.status).toBe(200);
    expect(insertChat).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when insertChat fails", async () => {
    authedSession();
    vi.mocked(insertChat).mockResolvedValue(null);

    const res = await createSessionChatHandler(makeReq({}), "sess_1");
    expect(res.status).toBe(500);
  });
});
