import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistLatestUserMessage } from "@/lib/chat/persistLatestUserMessage";

import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";
import { updateChat } from "@/lib/supabase/chats/updateChat";

vi.mock("@/lib/supabase/chat_messages/upsertChatMessage", () => ({
  upsertChatMessage: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({
  selectChatMessages: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/updateChat", () => ({
  updateChat: vi.fn(),
}));

const CHAT_ID = "chat-1";
const MSG_ID = "msg-1";

function userMessage(text = "hello world", id = MSG_ID) {
  return { id, role: "user" as const, parts: [{ type: "text" as const, text }] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("persistLatestUserMessage", () => {
  it("no-ops when the last message is not a user message", async () => {
    await persistLatestUserMessage(CHAT_ID, [{ id: "a", role: "assistant", parts: [] } as never]);
    expect(upsertChatMessage).not.toHaveBeenCalled();
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("no-ops when messages array is empty", async () => {
    await persistLatestUserMessage(CHAT_ID, []);
    expect(upsertChatMessage).not.toHaveBeenCalled();
  });

  it("bails on DB error (upsert ok:false) without touching the chat", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({ ok: false, error: "down" });
    await persistLatestUserMessage(CHAT_ID, [userMessage()]);
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("bails on duplicate (already persisted) without touching the chat", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({ ok: true, row: null, isDuplicate: true });
    await persistLatestUserMessage(CHAT_ID, [userMessage()]);
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("touches updated_at after a new insert", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: { id: MSG_ID } as never,
      isDuplicate: false,
    });
    vi.mocked(selectChatMessages).mockResolvedValue([{ id: "different-msg" } as never]);
    await persistLatestUserMessage(CHAT_ID, [userMessage()]);
    const firstCall = vi.mocked(updateChat).mock.calls[0];
    expect(firstCall?.[0]).toEqual({ id: CHAT_ID });
    expect(firstCall?.[1]).toMatchObject({ updated_at: expect.any(String) });
  });

  it("sets chat.title when the inserted message is the earliest", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: { id: MSG_ID } as never,
      isDuplicate: false,
    });
    vi.mocked(selectChatMessages).mockResolvedValue([{ id: MSG_ID } as never]);
    await persistLatestUserMessage(CHAT_ID, [userMessage("Hello there from a test")]);
    const titleCall = vi
      .mocked(updateChat)
      .mock.calls.find(c => (c[1] as { title?: string }).title !== undefined);
    expect(titleCall?.[1]).toEqual({ title: "Hello there from a test" });
  });

  it("skips title when the inserted message is no longer the earliest", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: { id: MSG_ID } as never,
      isDuplicate: false,
    });
    vi.mocked(selectChatMessages).mockResolvedValue([{ id: "older-msg" } as never]);
    await persistLatestUserMessage(CHAT_ID, [userMessage()]);
    const titleCall = vi
      .mocked(updateChat)
      .mock.calls.find(c => (c[1] as { title?: string }).title !== undefined);
    expect(titleCall).toBeUndefined();
  });

  it("truncates titles to exactly TITLE_MAX_LENGTH including the suffix", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: { id: MSG_ID } as never,
      isDuplicate: false,
    });
    vi.mocked(selectChatMessages).mockResolvedValue([{ id: MSG_ID } as never]);
    const long = "x".repeat(120);
    await persistLatestUserMessage(CHAT_ID, [userMessage(long)]);
    const titleCall = vi
      .mocked(updateChat)
      .mock.calls.find(c => (c[1] as { title?: string }).title !== undefined);
    const title = (titleCall?.[1] as { title: string }).title;
    expect(title.length).toBe(80);
    expect(title.endsWith("…")).toBe(true);
  });

  it("bails on title-set when selectChatMessages errors (null)", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: { id: MSG_ID } as never,
      isDuplicate: false,
    });
    vi.mocked(selectChatMessages).mockResolvedValue(null);
    await persistLatestUserMessage(CHAT_ID, [userMessage()]);
    const titleCall = vi
      .mocked(updateChat)
      .mock.calls.find(c => (c[1] as { title?: string }).title !== undefined);
    expect(titleCall).toBeUndefined();
  });

  it("swallows thrown errors without escaping", async () => {
    vi.mocked(upsertChatMessage).mockRejectedValue(new Error("boom"));
    await expect(persistLatestUserMessage(CHAT_ID, [userMessage()])).resolves.toBeUndefined();
  });
});
