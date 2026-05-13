import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { baseChat, makeChatsListReq, mockSession } from "./chatsRouteTestFixtures";

vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));

vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

vi.mock("@/lib/supabase/chat_reads/selectChatReadsByAccountAndChatIds", () => ({
  selectChatReadsByAccountAndChatIds: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const { selectSessions } = await import("@/lib/supabase/sessions/selectSessions");
const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { selectChatReadsByAccountAndChatIds } = await import(
  "@/lib/supabase/chat_reads/selectChatReadsByAccountAndChatIds"
);
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");

describe("GET /api/sessions/[sessionId]/chats — list payload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with ChatSummary list and defaultModelId", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc-uuid-1",
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([mockSession]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChat({
        id: "c1",
        last_assistant_message_at: "2026-05-02T00:00:00.000Z",
        created_at: "2026-05-01T10:00:00.000Z",
      }),
    ]);
    vi.mocked(selectChatReadsByAccountAndChatIds).mockResolvedValue([
      {
        account_id: "acc-uuid-1",
        chat_id: "c1",
        created_at: "2026-05-01T00:00:00.000Z",
        last_read_at: "2026-05-03T00:00:00.000Z",
        updated_at: "2026-05-01T00:00:00.000Z",
      },
    ]);

    const res = await GET(makeChatsListReq(), {
      params: Promise.resolve({ sessionId: "sess_1" }),
    });
    expect(res.status).toBe(200);
    expect(selectChats).toHaveBeenCalledWith({
      sessionId: "sess_1",
      orderCreatedAtAscending: true,
    });
    expect(selectChatReadsByAccountAndChatIds).toHaveBeenCalledWith("acc-uuid-1", ["c1"]);

    const body = await res.json();
    expect(body.defaultModelId).toBe("openai/gpt-5-mini");
    expect(body.chats).toEqual([
      {
        id: "c1",
        sessionId: "sess_1",
        title: "New chat",
        modelId: "openai/gpt-5",
        activeStreamId: null,
        lastAssistantMessageAt: "2026-05-02T00:00:00.000Z",
        createdAt: "2026-05-01T10:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
        hasUnread: false,
        isStreaming: false,
      },
    ]);
  });
});
