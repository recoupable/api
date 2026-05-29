import { describe, it, expect, vi, beforeEach } from "vitest";

import { migrateRoom } from "@/scripts/backfill/migrateRoom";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { insertSession } from "@/lib/supabase/sessions/insertSession";
import { selectChats } from "@/lib/supabase/chats/selectChats";
import { insertChat } from "@/lib/supabase/chats/insertChat";
import { selectMemoriesByRoomId } from "@/lib/supabase/memories/selectMemoriesByRoomId";
import { upsertChatMessages } from "@/lib/supabase/chat_messages/upsertChatMessages";

vi.mock("@/lib/supabase/sessions/selectSessions", () => ({ selectSessions: vi.fn() }));
vi.mock("@/lib/supabase/sessions/insertSession", () => ({ insertSession: vi.fn() }));
vi.mock("@/lib/supabase/chats/selectChats", () => ({ selectChats: vi.fn() }));
vi.mock("@/lib/supabase/chats/insertChat", () => ({ insertChat: vi.fn() }));
vi.mock("@/lib/supabase/memories/selectMemoriesByRoomId", () => ({
  selectMemoriesByRoomId: vi.fn(),
}));
vi.mock("@/lib/supabase/chat_messages/upsertChatMessages", () => ({
  upsertChatMessages: vi.fn(),
}));

const room: any = {
  id: "room-1",
  account_id: "acc-1",
  artist_id: null,
  topic: "Hello",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectSessions).mockResolvedValue([]);
  vi.mocked(selectChats).mockResolvedValue([]);
  vi.mocked(selectMemoriesByRoomId).mockResolvedValue([
    {
      id: "m1",
      room_id: "room-1",
      content: { role: "user", parts: [{ type: "text", text: "hi" }] },
      updated_at: "2026-01-01T00:00:00Z",
    } as any,
    {
      id: "m2",
      room_id: "room-1",
      content: { role: "assistant", parts: null }, // malformed — null parts
      updated_at: "2026-01-01T00:00:01Z",
    } as any,
  ]);

  vi.mocked(insertSession).mockResolvedValue({ id: "s1" } as any);

  vi.mocked(insertChat).mockResolvedValue({ id: "room-1" } as any);
  vi.mocked(upsertChatMessages).mockResolvedValue(1);
});

describe("migrateRoom", () => {
  it("performs NO writes in dry-run mode but still reads + reports stats", async () => {
    const stats = await migrateRoom(room, { dryRun: true });

    expect(insertSession).not.toHaveBeenCalled();
    expect(insertChat).not.toHaveBeenCalled();
    expect(upsertChatMessages).not.toHaveBeenCalled();

    expect(selectSessions).toHaveBeenCalled();
    expect(selectChats).toHaveBeenCalled();
    expect(selectMemoriesByRoomId).toHaveBeenCalledWith("room-1");

    expect(stats).toMatchObject({
      status: "migrated",
      messagesWritten: 1, // only the well-formed memory
      messagesMalformed: 1, // the null-parts memory
      memoryCount: 2,
    });
  });

  it("writes session, chat, and only well-formed messages in a real run", async () => {
    const stats = await migrateRoom(room, { dryRun: false });

    expect(insertSession).toHaveBeenCalledTimes(1);
    expect(insertChat).toHaveBeenCalledTimes(1);
    // one batch call containing only the well-formed message
    expect(upsertChatMessages).toHaveBeenCalledTimes(1);
    expect(upsertChatMessages).toHaveBeenCalledWith([
      expect.objectContaining({ id: "m1", chat_id: "room-1", role: "user" }),
    ]);
    expect(stats.messagesWritten).toBe(1);
    expect(stats.messagesMalformed).toBe(1);
  });

  it("skips rooms with no account_id", async () => {
    const stats = await migrateRoom({ ...room, account_id: null }, { dryRun: false });

    expect(stats.status).toBe("skipped");
    expect(insertSession).not.toHaveBeenCalled();
    expect(insertChat).not.toHaveBeenCalled();
  });

  it("skips session/chat inserts when they already exist (idempotent re-run)", async () => {
    vi.mocked(selectSessions).mockResolvedValue([{ id: "s1" } as any]);

    vi.mocked(selectChats).mockResolvedValue([{ id: "room-1" } as any]);

    const stats = await migrateRoom(room, { dryRun: false });

    expect(insertSession).not.toHaveBeenCalled();
    expect(insertChat).not.toHaveBeenCalled();
    expect(stats.sessionExisted).toBe(true);
    expect(stats.chatExisted).toBe(true);
  });
});
