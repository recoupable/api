import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Tables } from "@/types/database.types";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_reads/selectChatReads", () => ({
  selectChatReads: vi.fn(),
}));

const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { selectChatReads } = await import("@/lib/supabase/chat_reads/selectChatReads");
const { getChatSummaries } = await import("@/lib/supabase/chats/getChatSummaries");

const accountId = "acc-uuid-1";

function chatRow(overrides: Partial<Tables<"chats">>): Tables<"chats"> {
  return baseChatRow({ session_id: "sess_1", ...overrides });
}

describe("getChatSummaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] without hitting chat_reads when the session has no chats", async () => {
    vi.mocked(selectChats).mockResolvedValue([]);

    const result = await getChatSummaries({
      sessionId: "sess_1",
      accountId,
    });

    expect(result).toEqual([]);
    expect(selectChatReads).not.toHaveBeenCalled();
  });

  it("sorts summaries by createdAt ascending and uses APP_DEFAULT shape", async () => {
    vi.mocked(selectChats).mockResolvedValue([
      chatRow({
        id: "chat_late",
        title: "Late",
        created_at: "2026-05-04T00:00:00.000Z",
      }),
      chatRow({
        id: "chat_early",
        title: "Early",
        created_at: "2026-05-01T00:00:00.000Z",
      }),
    ]);
    vi.mocked(selectChatReads).mockResolvedValue([]);

    const result = await getChatSummaries({
      sessionId: "sess_1",
      accountId,
    });

    expect(result.map(c => c.id)).toEqual(["chat_early", "chat_late"]);
    expect(result[0]).toMatchObject({
      sessionId: "sess_1",
      title: "Early",
      hasUnread: false,
      isStreaming: false,
    });
    expect(selectChatReads).toHaveBeenCalledWith({
      accountId,
      chatIds: ["chat_late", "chat_early"],
    });
  });

  it("derives hasUnread from last_assistant_message_at vs last_read_at", async () => {
    vi.mocked(selectChats).mockResolvedValue([
      chatRow({
        id: "chat_unread",
        last_assistant_message_at: "2026-05-04T10:00:00.000Z",
        active_stream_id: null,
      }),
      chatRow({
        id: "chat_read",
        last_assistant_message_at: "2026-05-03T10:00:00.000Z",
        active_stream_id: null,
      }),
      chatRow({
        id: "chat_never_assistant",
        last_assistant_message_at: null,
        active_stream_id: null,
      }),
      chatRow({
        id: "chat_streaming",
        last_assistant_message_at: null,
        active_stream_id: "stream_xyz",
      }),
    ]);
    vi.mocked(selectChatReads).mockResolvedValue([
      {
        account_id: accountId,
        chat_id: "chat_unread",
        last_read_at: "2026-05-04T09:00:00.000Z",
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-04T09:00:00.000Z",
      },
      {
        account_id: accountId,
        chat_id: "chat_read",
        last_read_at: "2026-05-04T00:00:00.000Z",
        created_at: "2026-05-01T00:00:00.000Z",
        updated_at: "2026-05-04T00:00:00.000Z",
      },
    ]);

    const result = await getChatSummaries({
      sessionId: "sess_1",
      accountId,
    });

    const byId = new Map(result.map(c => [c.id, c]));
    expect(byId.get("chat_unread")?.hasUnread).toBe(true);
    expect(byId.get("chat_read")?.hasUnread).toBe(false);
    expect(byId.get("chat_never_assistant")?.hasUnread).toBe(false);
    expect(byId.get("chat_streaming")?.hasUnread).toBe(false);
    expect(byId.get("chat_streaming")?.isStreaming).toBe(true);
    expect(byId.get("chat_unread")?.isStreaming).toBe(false);
  });

  it("treats a missing chat_reads row as fully unread when assistant has replied", async () => {
    vi.mocked(selectChats).mockResolvedValue([
      chatRow({
        id: "chat_no_read",
        last_assistant_message_at: "2026-05-04T10:00:00.000Z",
      }),
    ]);
    vi.mocked(selectChatReads).mockResolvedValue([]);

    const result = await getChatSummaries({
      sessionId: "sess_1",
      accountId,
    });

    expect(result[0].hasUnread).toBe(true);
  });
});
