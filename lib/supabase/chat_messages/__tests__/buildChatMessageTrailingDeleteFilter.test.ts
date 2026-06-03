import { describe, expect, it } from "vitest";
import { buildChatMessageTrailingDeleteFilter } from "@/lib/supabase/chat_messages/buildChatMessageTrailingDeleteFilter";

describe("buildChatMessageTrailingDeleteFilter", () => {
  it("uses created_at and id for a stable trailing boundary", () => {
    const filter = buildChatMessageTrailingDeleteFilter({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "123e4567-e89b-42d3-a456-426614174001",
    });

    expect(filter).toBe(
      'created_at.gt."2026-01-01T00:00:00.000Z",and(created_at.eq."2026-01-01T00:00:00.000Z",id.gte.123e4567-e89b-42d3-a456-426614174001)',
    );
  });
});
