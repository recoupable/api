import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
const { updateChat } = await import("@/lib/supabase/chats/updateChat");
const { persistSessionChatAssistantMessageHandler } = await import(
  "@/lib/sessions/chats/persistSessionChatAssistantMessageHandler"
);

describe("persistSessionChatAssistantMessageHandler — insert path", () => {
  beforeEach(() => vi.clearAllMocks());

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
    const res = await persistSessionChatAssistantMessageHandler(
      new NextRequest("http://localhost", { method: "POST" }),
      "sess_1",
      "chat_a",
    );
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
    const res = await persistSessionChatAssistantMessageHandler(
      new NextRequest("http://localhost", { method: "POST" }),
      "sess_1",
      "chat_a",
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      status: "error",
      error: "Internal server error",
    });
  });
});
