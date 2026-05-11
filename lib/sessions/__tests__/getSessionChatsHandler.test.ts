import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { Tables } from "@/types/database.types";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sessions/validateOwnedSessionRequest", () => ({
  validateOwnedSessionRequest: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_reads/selectChatReads", () => ({
  selectChatReads: vi.fn(),
}));

const { validateOwnedSessionRequest } = await import("@/lib/sessions/validateOwnedSessionRequest");
const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { selectChatReads } = await import("@/lib/supabase/chat_reads/selectChatReads");
const { getSessionChatsHandler } = await import("@/lib/sessions/getSessionChatsHandler");

const accountId = "acc-uuid-1";

function makeReq(url = "https://example.com/api/sessions/sess_1/chats"): NextRequest {
  return new NextRequest(url);
}

function chatRow(overrides: Partial<Tables<"chats">>): Tables<"chats"> {
  return baseChatRow({ session_id: "sess_1", ...overrides });
}

function mockOwned() {
  vi.mocked(validateOwnedSessionRequest).mockResolvedValue({
    auth: { accountId, orgId: null, authToken: "tok" },
    session: baseSessionRow({ id: "sess_1", account_id: accountId }),
  });
}

describe("getSessionChatsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the NextResponse from validateOwnedSessionRequest as-is", async () => {
    const failure = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(validateOwnedSessionRequest).mockResolvedValue(failure);

    const res = await getSessionChatsHandler(makeReq(), "sess_1");
    expect(res).toBe(failure);
    expect(selectChats).not.toHaveBeenCalled();
  });

  it("returns 200 with chats sorted by created_at and APP_DEFAULT_MODEL_ID", async () => {
    mockOwned();
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

    const res = await getSessionChatsHandler(makeReq(), "sess_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      chats: Array<{ id: string; hasUnread: boolean; isStreaming: boolean }>;
      defaultModelId: string;
    };
    expect(body.chats.map(c => c.id)).toEqual(["chat_early", "chat_late"]);
    expect(body.defaultModelId).toBe("openai/gpt-5.4");
    expect(selectChatReads).toHaveBeenCalledWith({
      accountId,
      chatIds: ["chat_late", "chat_early"],
    });
  });

  it("skips chat_reads lookup when the session has no chats", async () => {
    mockOwned();
    vi.mocked(selectChats).mockResolvedValue([]);

    const res = await getSessionChatsHandler(makeReq(), "sess_1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      chats: unknown[];
      defaultModelId: string;
    };
    expect(body.chats).toEqual([]);
    expect(body.defaultModelId).toBe("openai/gpt-5.4");
    expect(selectChatReads).not.toHaveBeenCalled();
  });

  it("derives hasUnread from last_assistant_message_at vs last_read_at", async () => {
    mockOwned();
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

    const res = await getSessionChatsHandler(makeReq(), "sess_1");
    const body = (await res.json()) as {
      chats: Array<{ id: string; hasUnread: boolean; isStreaming: boolean }>;
    };
    const byId = new Map(body.chats.map(c => [c.id, c]));
    expect(byId.get("chat_unread")?.hasUnread).toBe(true);
    expect(byId.get("chat_read")?.hasUnread).toBe(false);
    expect(byId.get("chat_streaming")?.hasUnread).toBe(false);
    expect(byId.get("chat_streaming")?.isStreaming).toBe(true);
    expect(byId.get("chat_unread")?.isStreaming).toBe(false);
  });
});
