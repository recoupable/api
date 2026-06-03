import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasActiveStreamForSession } from "@/lib/sandbox/hasActiveStreamForSession";
import { selectChats } from "@/lib/supabase/chats/selectChats";

vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

const sessionId = "123e4567-e89b-42d3-a456-426614174010";

describe("hasActiveStreamForSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when chat lookup fails", async () => {
    vi.mocked(selectChats).mockResolvedValue(null);

    await expect(hasActiveStreamForSession(sessionId)).resolves.toBeNull();
  });

  it("returns true when any chat has an active stream", async () => {
    vi.mocked(selectChats).mockResolvedValue([
      { active_stream_id: null } as never,
      { active_stream_id: "stream-1" } as never,
    ]);

    await expect(hasActiveStreamForSession(sessionId)).resolves.toBe(true);
  });

  it("returns false when no chat has an active stream", async () => {
    vi.mocked(selectChats).mockResolvedValue([
      { active_stream_id: null } as never,
      { active_stream_id: null } as never,
    ]);

    await expect(hasActiveStreamForSession(sessionId)).resolves.toBe(false);
  });
});
