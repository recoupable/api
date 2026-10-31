import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEFAULT_MODEL } from "@/lib/const";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { selectChatReads } from "@/lib/supabase/chat_reads/selectChatReads";
import { validateGetSessionChatsRequest } from "@/lib/sessions/chats/validateGetSessionChatsRequest";
import { getChatSummaries } from "@/lib/sessions/chats/getChatSummaries";
import { GET } from "@/app/api/sessions/[sessionId]/chats/route";

vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/supabase/chat_reads/selectChatReads", () => ({ selectChatReads: vi.fn() }));
vi.mock("@/lib/sessions/chats/validateGetSessionChatsRequest", () => ({
  validateGetSessionChatsRequest: vi.fn(),
}));
vi.mock("@/lib/sessions/chats/createSessionChatHandler", () => ({
  createSessionChatHandler: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));

const params = { sessionId: "sess_1", accountId: "account_1" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(selectChatReads).mockResolvedValue([]);
  vi.mocked(validateGetSessionChatsRequest).mockResolvedValue({
    auth: { accountId: params.accountId, orgId: null, authToken: "synthetic" },
    session: baseSessionRow({ id: params.sessionId, account_id: params.accountId }),
  });
});

describe("session chat summary models", () => {
  it("uses the current default for null models and preserves a saved model", async () => {
    const rows = [
      baseChatRow({ id: "later", model_id: "saved-model", created_at: "2026-05-05T00:00:00Z" }),
      baseChatRow({ id: "earlier", model_id: null }),
    ];
    vi.mocked(selectChats).mockResolvedValue(rows);

    const summaries = await getChatSummaries(params);

    expect(summaries?.map(({ id, modelId }) => ({ id, modelId }))).toEqual([
      { id: "earlier", modelId: DEFAULT_MODEL },
      { id: "later", modelId: "saved-model" },
    ]);
    expect(rows.map(row => row.id)).toEqual(["later", "earlier"]);
    expect(rows[1].model_id).toBeNull();
    expect(selectChats).toHaveBeenCalledWith({ sessionId: params.sessionId });
    expect(selectChatReads).toHaveBeenCalledWith({
      accountId: params.accountId,
      chatIds: ["later", "earlier"],
    });
  });

  it("retains unread and streaming state when applying the model fallback", async () => {
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({
        active_stream_id: "stream_1",
        last_assistant_message_at: "2026-05-06T00:00:00Z",
      }),
    ]);
    expect(await getChatSummaries(params)).toEqual([
      expect.objectContaining({ modelId: DEFAULT_MODEL, hasUnread: true, isStreaming: true }),
    ]);
  });

  it("keeps failed chat reads distinct from an empty successful list", async () => {
    vi.mocked(selectChats).mockResolvedValueOnce(null).mockResolvedValueOnce([]);
    expect(await getChatSummaries(params)).toBeNull();
    expect(await getChatSummaries(params)).toEqual([]);
    expect(selectChatReads).not.toHaveBeenCalled();
  });

  it("returns the per-chat fallback through the canonical GET route", async () => {
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow(),
      baseChatRow({ id: "chat_2", model_id: "saved-model" }),
    ]);
    const response = await GET(
      new NextRequest("https://example.invalid/api/sessions/sess_1/chats"),
      {
        params: Promise.resolve({ sessionId: params.sessionId }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      defaultModelId: DEFAULT_MODEL,
      chats: [{ modelId: DEFAULT_MODEL }, { modelId: "saved-model" }],
    });
  });
});
