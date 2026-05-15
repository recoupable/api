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
const { persistSessionChatAssistantMessageHandler } = await import(
  "@/lib/sessions/chats/persistSessionChatAssistantMessageHandler"
);

const row = (
  chatId: string,
  role: string,
): {
  id: string;
  chat_id: string;
  role: string;
  parts: unknown[];
  created_at: string;
} => ({
  id: "msg_1",
  chat_id: chatId,
  role,
  parts: [],
  created_at: "2026-05-01T00:00:00.000Z",
});

describe("persistSessionChatAssistantMessageHandler — routing & conflict", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards NextResponse from the validator unchanged", async () => {
    const failure = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue(failure);
    const res = await persistSessionChatAssistantMessageHandler(
      new NextRequest("http://localhost", { method: "POST" }),
      "sess_1",
      "chat_a",
    );
    expect(res).toBe(failure);
    expect(insertChatMessage).not.toHaveBeenCalled();
  });

  it("returns 409 when message id belongs to another chat", async () => {
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue({
      message: { id: "msg_1", role: "assistant", parts: [] },
    });
    vi.mocked(selectChatMessageById).mockResolvedValue(row("chat_OTHER", "assistant"));
    const res = await persistSessionChatAssistantMessageHandler(
      new NextRequest("http://localhost", { method: "POST" }),
      "sess_1",
      "chat_a",
    );
    expect(res.status).toBe(409);
    expect(updateChatMessageParts).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({
      error: "Message ID already belongs to a different chat or role",
    });
  });

  it("returns 409 when stored role is not assistant", async () => {
    vi.mocked(validatePersistSessionChatAssistantMessageRequest).mockResolvedValue({
      message: { id: "msg_1", role: "assistant", parts: [] },
    });
    vi.mocked(selectChatMessageById).mockResolvedValue(row("chat_a", "user"));
    const res = await persistSessionChatAssistantMessageHandler(
      new NextRequest("http://localhost", { method: "POST" }),
      "sess_1",
      "chat_a",
    );
    expect(res.status).toBe(409);
  });
});
