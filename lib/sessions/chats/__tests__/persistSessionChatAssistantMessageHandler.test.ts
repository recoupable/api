import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/chats/validatePersistSessionChatAssistantMessageRequest", () => ({
  validatePersistSessionChatAssistantMessageRequest: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_messages/selectChatMessageById", () => ({
  selectChatMessageById: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_messages/insertChatMessage", () => ({
  insertChatMessage: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_messages/updateChatMessageParts", () => ({
  updateChatMessageParts: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/updateChat", () => ({
  updateChat: vi.fn(),
}));

const { validatePersistSessionChatAssistantMessageRequest } = await import(
  "@/lib/sessions/chats/validatePersistSessionChatAssistantMessageRequest"
);
const { selectChatMessageById } = await import(
  "@/lib/supabase/chat_messages/selectChatMessageById"
);
const { insertChatMessage } = await import("@/lib/supabase/chat_messages/insertChatMessage");
const { updateChatMessageParts } = await import(
  "@/lib/supabase/chat_messages/updateChatMessageParts"
);
const { updateChat } = await import("@/lib/supabase/chats/updateChat");
const { persistSessionChatAssistantMessageHandler } = await import(
  "@/lib/sessions/chats/persistSessionChatAssistantMessageHandler"
);

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_a/messages", {
    method: "POST",
  });
}

describe("persistSessionChatAssistantMessageHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards NextResponse from the validator unchanged", async () => {
    const failure = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue(failure);

    const res = await persistSessionChatAssistantMessageHandler(makeReq(), "sess_1", "chat_a");
    expect(res).toBe(failure);
    expect(insertChatMessage).not.toHaveBeenCalled();
  });

  it("returns 409 when message id belongs to another chat", async () => {
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue({
      message: { id: "msg_1", role: "assistant", parts: [] },
    });
    vi.mocked(selectChatMessageById).mockResolvedValue({
      id: "msg_1",
      chat_id: "chat_OTHER",
      role: "assistant",
      parts: [],
      created_at: "2026-05-01T00:00:00.000Z",
    });

    const res = await persistSessionChatAssistantMessageHandler(makeReq(), "sess_1", "chat_a");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Message ID already belongs to a different chat or role",
    });
    expect(updateChatMessageParts).not.toHaveBeenCalled();
  });

  it("returns 409 when message id belongs to non-assistant role", async () => {
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue({
      message: { id: "msg_1", role: "assistant", parts: [] },
    });
    vi.mocked(selectChatMessageById).mockResolvedValue({
      id: "msg_1",
      chat_id: "chat_a",
      role: "user",
      parts: [],
      created_at: "2026-05-01T00:00:00.000Z",
    });

    const res = await persistSessionChatAssistantMessageHandler(makeReq(), "sess_1", "chat_a");
    expect(res.status).toBe(409);
  });

  it("updates existing assistant row and returns updated", async () => {
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue({
      message: { id: "msg_1", role: "assistant", parts: [{ t: 1 }] },
    });
    vi.mocked(selectChatMessageById).mockResolvedValue({
      id: "msg_1",
      chat_id: "chat_a",
      role: "assistant",
      parts: [],
      created_at: "2026-05-01T00:00:00.000Z",
    });
    vi.mocked(updateChatMessageParts).mockResolvedValue(true);
    vi.mocked(updateChat).mockResolvedValue(true);

    const res = await persistSessionChatAssistantMessageHandler(makeReq(), "sess_1", "chat_a");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, status: "updated" });
    expect(updateChatMessageParts).toHaveBeenCalledWith("msg_1", [{ t: 1 }]);
    expect(insertChatMessage).not.toHaveBeenCalled();
  });

  it("inserts when no existing row", async () => {
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue({
      message: { id: "msg_new", role: "assistant", parts: [{ x: 1 }] },
    });
    vi.mocked(selectChatMessageById).mockResolvedValue(null);
    vi.mocked(insertChatMessage).mockResolvedValue({
      id: "msg_new",
      chat_id: "chat_a",
      role: "assistant",
      parts: [{ x: 1 }],
      created_at: "2026-05-01T00:00:00.000Z",
    });
    vi.mocked(updateChat).mockResolvedValue(true);

    const res = await persistSessionChatAssistantMessageHandler(makeReq(), "sess_1", "chat_a");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, status: "inserted" });
    expect(insertChatMessage).toHaveBeenCalledWith({
      id: "msg_new",
      chat_id: "chat_a",
      role: "assistant",
      parts: [{ x: 1 }],
    });
  });

  it("returns 500 when insertChatMessage fails", async () => {
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue({
      message: { id: "msg_new", role: "assistant", parts: [] },
    });
    vi.mocked(selectChatMessageById).mockResolvedValue(null);
    vi.mocked(insertChatMessage).mockResolvedValue(null);

    const res = await persistSessionChatAssistantMessageHandler(makeReq(), "sess_1", "chat_a");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ status: "error", error: "Failed to persist message" });
  });

  it("returns 500 when updateChatMessageParts fails", async () => {
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue({
      message: { id: "msg_1", role: "assistant", parts: [] },
    });
    vi.mocked(selectChatMessageById).mockResolvedValue({
      id: "msg_1",
      chat_id: "chat_a",
      role: "assistant",
      parts: [],
      created_at: "2026-05-01T00:00:00.000Z",
    });
    vi.mocked(updateChatMessageParts).mockResolvedValue(false);

    const res = await persistSessionChatAssistantMessageHandler(makeReq(), "sess_1", "chat_a");
    expect(res.status).toBe(500);
  });
});
