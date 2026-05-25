import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistAssistantMessage } from "@/lib/chat/persistAssistantMessage";
import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";
import { updateChat } from "@/lib/supabase/chats/updateChat";

vi.mock("@/lib/supabase/chat_messages/upsertChatMessage", () => ({
  upsertChatMessage: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/updateChat", () => ({
  updateChat: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateChat).mockResolvedValue({
    ok: true,
    rowsUpdated: 1,
    row: null,
  });
});

const CHAT_ID = "11111111-1111-1111-1111-111111111111";
const ASSISTANT_ID = "msg_abc";

function buildAssistantMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSISTANT_ID,
    role: "assistant",
    parts: [{ type: "text", text: "Hello!" }],
    ...overrides,
  };
}

describe("persistAssistantMessage", () => {
  it("upserts the assistant message row with role 'assistant'", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: { id: ASSISTANT_ID } as never,
      isDuplicate: false,
    });

    await persistAssistantMessage(CHAT_ID, buildAssistantMessage());

    expect(upsertChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ASSISTANT_ID,
        chat_id: CHAT_ID,
        role: "assistant",
      }),
    );
  });

  it("touches updated_at on the chat row on a fresh insert", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: { id: ASSISTANT_ID } as never,
      isDuplicate: false,
    });

    await persistAssistantMessage(CHAT_ID, buildAssistantMessage());

    expect(updateChat).toHaveBeenCalledWith(
      { id: CHAT_ID },
      expect.objectContaining({ updated_at: expect.any(String) }),
    );
  });

  it("does NOT touch updated_at on duplicate (workflow replay)", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: null,
      isDuplicate: true,
    });

    await persistAssistantMessage(CHAT_ID, buildAssistantMessage());

    expect(updateChat).not.toHaveBeenCalled();
  });

  it("silently no-ops when the message role is not 'assistant' (guard against caller mistakes)", async () => {
    await persistAssistantMessage(CHAT_ID, buildAssistantMessage({ role: "user" }));

    expect(upsertChatMessage).not.toHaveBeenCalled();
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("silently no-ops when the upsert reports a DB error (fire-and-forget contract)", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: false,
      error: "transient db error",
    });

    await expect(
      persistAssistantMessage(CHAT_ID, buildAssistantMessage()),
    ).resolves.toBeUndefined();
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("swallows unexpected exceptions (must not bubble up)", async () => {
    vi.mocked(upsertChatMessage).mockRejectedValue(new Error("boom"));

    await expect(
      persistAssistantMessage(CHAT_ID, buildAssistantMessage()),
    ).resolves.toBeUndefined();
  });
});
