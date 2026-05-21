import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistLatestUserMessage } from "@/lib/chat/persistLatestUserMessage";

import { createChatMessageIfNotExists } from "@/lib/supabase/chat_messages/createChatMessageIfNotExists";
import { isFirstChatMessage } from "@/lib/supabase/chat_messages/isFirstChatMessage";
import { touchChat } from "@/lib/supabase/chats/touchChat";
import { updateChat } from "@/lib/supabase/chats/updateChat";

vi.mock("@/lib/supabase/chat_messages/createChatMessageIfNotExists", () => ({
  createChatMessageIfNotExists: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_messages/isFirstChatMessage", () => ({
  isFirstChatMessage: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/touchChat", () => ({ touchChat: vi.fn() }));
vi.mock("@/lib/supabase/chats/updateChat", () => ({ updateChat: vi.fn() }));

const CHAT_ID = "chat-1";

function userMessage(text = "hello world", id = "msg-1") {
  return { id, role: "user" as const, parts: [{ type: "text" as const, text }] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("persistLatestUserMessage", () => {
  it("inserts the latest user message and touches the chat", async () => {
    vi.mocked(createChatMessageIfNotExists).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(isFirstChatMessage).mockResolvedValue(false);
    await persistLatestUserMessage(CHAT_ID, [userMessage()]);
    expect(createChatMessageIfNotExists).toHaveBeenCalledWith({
      id: "msg-1",
      chat_id: CHAT_ID,
      role: "user",
      parts: userMessage(),
    });
    expect(touchChat).toHaveBeenCalledWith(CHAT_ID);
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("no-ops when the last message is not a user message", async () => {
    await persistLatestUserMessage(CHAT_ID, [{ id: "a", role: "assistant", parts: [] } as never]);
    expect(createChatMessageIfNotExists).not.toHaveBeenCalled();
    expect(touchChat).not.toHaveBeenCalled();
  });

  it("no-ops when messages array is empty", async () => {
    await persistLatestUserMessage(CHAT_ID, []);
    expect(createChatMessageIfNotExists).not.toHaveBeenCalled();
  });

  it("skips title-set when insert returns null (already existed)", async () => {
    vi.mocked(createChatMessageIfNotExists).mockResolvedValue(null);
    await persistLatestUserMessage(CHAT_ID, [userMessage()]);
    expect(touchChat).not.toHaveBeenCalled();
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("sets chat.title from message text when this is the first message", async () => {
    vi.mocked(createChatMessageIfNotExists).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(isFirstChatMessage).mockResolvedValue(true);
    await persistLatestUserMessage(CHAT_ID, [userMessage("Hello there from a test")]);
    expect(updateChat).toHaveBeenCalledWith(CHAT_ID, { title: "Hello there from a test" });
  });

  it("truncates titles longer than 80 chars with ellipsis", async () => {
    vi.mocked(createChatMessageIfNotExists).mockResolvedValue({ id: "msg-1" } as never);
    vi.mocked(isFirstChatMessage).mockResolvedValue(true);
    const long = "x".repeat(120);
    await persistLatestUserMessage(CHAT_ID, [userMessage(long)]);
    const arg = vi.mocked(updateChat).mock.calls[0]?.[1] as { title: string };
    expect(arg.title.length).toBe(83);
    expect(arg.title.endsWith("...")).toBe(true);
  });

  it("swallows errors from helpers without throwing", async () => {
    vi.mocked(createChatMessageIfNotExists).mockRejectedValue(new Error("db down"));
    await expect(persistLatestUserMessage(CHAT_ID, [userMessage()])).resolves.toBeUndefined();
  });
});
