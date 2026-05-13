import { describe, it, expect } from "vitest";
import { toChatSummary } from "@/lib/sessions/toChatSummary";
import type { Tables } from "@/types/database.types";

const baseRow = (overrides: Partial<Tables<"chats">> = {}): Tables<"chats"> => ({
  id: "c1",
  session_id: "s1",
  title: "t",
  model_id: "m1",
  active_stream_id: null,
  last_assistant_message_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("toChatSummary", () => {
  it("hasUnread false when no assistant message", () => {
    const s = toChatSummary(baseRow(), null);
    expect(s.hasUnread).toBe(false);
  });

  it("hasUnread true when assistant message exists and there is no read row", () => {
    const s = toChatSummary(
      baseRow({ last_assistant_message_at: "2026-01-02T00:00:00.000Z" }),
      null,
    );
    expect(s.hasUnread).toBe(true);
  });

  it("hasUnread false when last read is after assistant message", () => {
    const s = toChatSummary(
      baseRow({ last_assistant_message_at: "2026-01-02T00:00:00.000Z" }),
      "2026-01-03T00:00:00.000Z",
    );
    expect(s.hasUnread).toBe(false);
  });
});
