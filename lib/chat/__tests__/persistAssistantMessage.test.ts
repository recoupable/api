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
  vi.mocked(updateChat).mockResolvedValue({ ok: true, rowsUpdated: 1, row: null });
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

function okUpsert() {
  vi.mocked(upsertChatMessage).mockResolvedValue({
    ok: true,
    row: { id: ASSISTANT_ID } as never,
    isDuplicate: false,
  });
}

describe("persistAssistantMessage", () => {
  it("upserts the assistant row with update:true (DO UPDATE — overwrite as it grows)", async () => {
    okUpsert();
    const message = buildAssistantMessage();

    await persistAssistantMessage(CHAT_ID, message as never);

    expect(upsertChatMessage).toHaveBeenCalledWith(
      { id: ASSISTANT_ID, chat_id: CHAT_ID, role: "assistant", parts: message },
      { update: true },
    );
  });

  it("bumps updated_at and last_assistant_message_at to the same timestamp on a successful persist", async () => {
    okUpsert();

    await persistAssistantMessage(CHAT_ID, buildAssistantMessage() as never);

    expect(updateChat).toHaveBeenCalledWith(
      { id: CHAT_ID },
      expect.objectContaining({
        updated_at: expect.any(String),
        last_assistant_message_at: expect.any(String),
      }),
    );
    const updateArgs = vi.mocked(updateChat).mock.calls[0]?.[1] as {
      updated_at?: string;
      last_assistant_message_at?: string;
    };
    expect(updateArgs.last_assistant_message_at).toBe(updateArgs.updated_at);
  });

  it("bumps activity on every persist so a partial/stopped reply still surfaces as unread", async () => {
    // Under DO UPDATE the upsert returns a row on both insert and update, so
    // a per-step partial message must keep marking the chat active — gating
    // the bump on "fresh insert only" would lose unread for stopped replies.
    okUpsert();

    await persistAssistantMessage(CHAT_ID, buildAssistantMessage() as never);
    await persistAssistantMessage(
      CHAT_ID,
      buildAssistantMessage({ parts: [{ type: "text", text: "Hello there!" }] }) as never,
    );

    expect(updateChat).toHaveBeenCalledTimes(2);
  });

  it("no-ops when the message role is not 'assistant' (guard against caller mistakes)", async () => {
    await persistAssistantMessage(CHAT_ID, buildAssistantMessage({ role: "user" }) as never);

    expect(upsertChatMessage).not.toHaveBeenCalled();
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("does not bump activity when the upsert reports a DB error (fire-and-forget contract)", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({ ok: false, error: "transient db error" });

    await expect(
      persistAssistantMessage(CHAT_ID, buildAssistantMessage() as never),
    ).resolves.toBeUndefined();
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("swallows unexpected exceptions (must not bubble up and tear down the stream)", async () => {
    vi.mocked(upsertChatMessage).mockRejectedValue(new Error("boom"));

    await expect(
      persistAssistantMessage(CHAT_ID, buildAssistantMessage() as never),
    ).resolves.toBeUndefined();
  });
});
