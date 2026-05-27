import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistAssistantDataPart } from "@/lib/chat/persistAssistantDataPart";
import { updateChatMessage } from "@/lib/supabase/chat_messages/updateChatMessage";

vi.mock("@/lib/supabase/chat_messages/updateChatMessage", () => ({
  updateChatMessage: vi.fn(),
}));

const baseMessage = {
  id: "msg_1",
  role: "assistant" as const,
  parts: [{ type: "text", text: "Hello" }] as never[],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateChatMessage).mockResolvedValue({ ok: true });
});

describe("persistAssistantDataPart", () => {
  it("merges the part into the message and writes the WHOLE merged message via updateChatMessage", async () => {
    const part = {
      type: "data-commit" as const,
      id: "msg_1:commit",
      data: { status: "success" as const },
    };

    await persistAssistantDataPart(baseMessage, part);

    expect(updateChatMessage).toHaveBeenCalledTimes(1);
    const [id, written] = vi.mocked(updateChatMessage).mock.calls[0]!;
    expect(id).toBe("msg_1");
    const message = written as typeof baseMessage;
    expect(message.id).toBe("msg_1");
    expect(message.role).toBe("assistant");
    expect(message.parts).toHaveLength(2);
    expect(message.parts[1]).toEqual(part);
  });

  it("replaces an existing data-part with matching {type, id} (pending → success transition)", async () => {
    const messageWithPending = {
      ...baseMessage,
      parts: [
        ...baseMessage.parts,
        {
          type: "data-commit",
          id: "msg_1:commit",
          data: { status: "pending" },
        },
      ],
    };
    const success = {
      type: "data-commit" as const,
      id: "msg_1:commit",
      data: { status: "success" as const, commitSha: "abc" },
    };

    await persistAssistantDataPart(messageWithPending, success);

    const [, written] = vi.mocked(updateChatMessage).mock.calls[0]!;
    const message = written as typeof messageWithPending;
    // Still 2 parts (text + commit), not 3
    expect(message.parts).toHaveLength(2);
    expect(message.parts[1]).toEqual(success);
  });

  it("does not throw when updateChatMessage rejects (caller decides what to do)", async () => {
    vi.mocked(updateChatMessage).mockResolvedValue({ ok: false, error: "boom" });
    await expect(
      persistAssistantDataPart(baseMessage, {
        type: "data-commit",
        id: "msg_1:commit",
        data: { status: "success" },
      }),
    ).resolves.toBeUndefined();
  });
});
