import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/chats/validateGetSessionChatRequest", () => ({
  validateGetSessionChatRequest: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({
  selectChatMessages: vi.fn(),
}));

const { validateGetSessionChatRequest } = await import(
  "@/lib/sessions/chats/validateGetSessionChatRequest"
);
const { selectChatMessages } = await import("@/lib/supabase/chat_messages/selectChatMessages");
const { getSessionChatHandler } = await import("@/lib/sessions/chats/getSessionChatHandler");

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_1");
}

function mockValidated(chatOverrides: Parameters<typeof baseChatRow>[0] = {}) {
  vi.mocked(validateGetSessionChatRequest).mockResolvedValue(
    baseChatRow({ id: "chat_1", session_id: "sess_1", ...chatOverrides }),
  );
}

describe("getSessionChatHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the NextResponse from validateGetSessionChatRequest as-is", async () => {
    const failure = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(validateGetSessionChatRequest).mockResolvedValue(failure);

    const res = await getSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res).toBe(failure);
    expect(selectChatMessages).not.toHaveBeenCalled();
  });

  it("returns 200 with chat, isStreaming=false, and message parts", async () => {
    mockValidated({ active_stream_id: null, model_id: "openai/gpt-5-mini" });
    vi.mocked(selectChatMessages).mockResolvedValue([
      {
        id: "msg_1",
        chat_id: "chat_1",
        role: "user",
        parts: [{ type: "text", text: "hi" }],
        created_at: "2026-05-01T00:00:00.000Z",
      },
      {
        id: "msg_2",
        chat_id: "chat_1",
        role: "assistant",
        parts: [{ type: "text", text: "hello" }],
        created_at: "2026-05-01T00:00:01.000Z",
      },
    ]);

    const res = await getSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      chat: {
        id: string;
        sessionId: string;
        title: string;
        modelId: string | null;
        activeStreamId: string | null;
        lastAssistantMessageAt: string | null;
        createdAt: string;
        updatedAt: string;
      };
      isStreaming: boolean;
      messages: unknown[];
    };
    expect(body.chat).toEqual({
      id: "chat_1",
      sessionId: "sess_1",
      title: "New chat",
      modelId: "openai/gpt-5-mini",
      activeStreamId: null,
      lastAssistantMessageAt: null,
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
    });
    expect(body.isStreaming).toBe(false);
    expect(body.messages).toEqual([
      [{ type: "text", text: "hi" }],
      [{ type: "text", text: "hello" }],
    ]);
    expect(selectChatMessages).toHaveBeenCalledWith({ chatId: "chat_1" });
  });

  it("derives isStreaming=true from active_stream_id", async () => {
    mockValidated({ active_stream_id: "stream-xyz" });
    vi.mocked(selectChatMessages).mockResolvedValue([]);

    const res = await getSessionChatHandler(makeReq(), "sess_1", "chat_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      chat: { activeStreamId: string | null };
      isStreaming: boolean;
      messages: unknown[];
    };
    expect(body.isStreaming).toBe(true);
    expect(body.chat.activeStreamId).toBe("stream-xyz");
    expect(body.messages).toEqual([]);
  });
});
