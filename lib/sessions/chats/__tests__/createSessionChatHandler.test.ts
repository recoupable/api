import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/chats/validateCreateSessionChatRequest", () => ({
  validateCreateSessionChatRequest: vi.fn(),
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

const { validateCreateSessionChatRequest } = await import(
  "@/lib/sessions/chats/validateCreateSessionChatRequest"
);
const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { insertChat } = await import("@/lib/supabase/chats/insertChat");
const { createSessionChatHandler } = await import("@/lib/sessions/chats/createSessionChatHandler");

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats", {
    method: "POST",
  });
}

function mockValidated(body: { id?: string } = {}) {
  vi.mocked(validateCreateSessionChatRequest).mockResolvedValue({
    auth: { accountId, orgId: null, authToken: "tok" },
    session: baseSessionRow({ id: "sess_1", account_id: accountId }),
    body,
  });
}

describe("createSessionChatHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the NextResponse from validateCreateSessionChatRequest as-is", async () => {
    const failure = NextResponse.json({ error: "Invalid chat id" }, { status: 400 });
    vi.mocked(validateCreateSessionChatRequest).mockResolvedValue(failure);

    const res = await createSessionChatHandler(makeReq(), "sess_1");
    expect(res).toBe(failure);
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("returns existing chat when requested id already exists in the same session", async () => {
    mockValidated({ id: "chat_existing" });
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({ id: "chat_existing", session_id: "sess_1", title: "Existing" }),
    ]);

    const res = await createSessionChatHandler(makeReq(), "sess_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { chat: { id: string; title: string } };
    expect(body.chat.id).toBe("chat_existing");
    expect(body.chat.title).toBe("Existing");
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("returns 409 when requested id exists in a different session", async () => {
    mockValidated({ id: "chat_existing" });
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({ id: "chat_existing", session_id: "sess_OTHER" }),
    ]);

    const res = await createSessionChatHandler(makeReq(), "sess_1");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Chat ID conflict" });
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("creates a chat with the requested id when none exists yet", async () => {
    mockValidated({ id: "chat_requested" });
    vi.mocked(selectChats).mockResolvedValue([]);
    vi.mocked(insertChat).mockResolvedValue(
      baseChatRow({ id: "chat_requested", session_id: "sess_1" }),
    );

    const res = await createSessionChatHandler(makeReq(), "sess_1");
    expect(res.status).toBe(200);
    const insertArgs = vi.mocked(insertChat).mock.calls[0][0];
    expect(insertArgs.id).toBe("chat_requested");
    expect(insertArgs.session_id).toBe("sess_1");
    expect(insertArgs.title).toBe("New chat");
  });

  it("creates a chat with a generated id when no id is provided", async () => {
    mockValidated({});
    vi.mocked(insertChat).mockResolvedValue(
      baseChatRow({ id: "generated-uuid", session_id: "sess_1" }),
    );

    const res = await createSessionChatHandler(makeReq(), "sess_1");
    expect(res.status).toBe(200);
    const insertArgs = vi.mocked(insertChat).mock.calls[0][0];
    expect(insertArgs.id).toBe("generated-uuid");
    expect(insertArgs.title).toBe("New chat");
    expect(selectChats).not.toHaveBeenCalled();
  });

  it("returns 500 when insertChat fails", async () => {
    mockValidated({});
    vi.mocked(insertChat).mockResolvedValue(null);

    const res = await createSessionChatHandler(makeReq(), "sess_1");
    expect(res.status).toBe(500);
  });
});
