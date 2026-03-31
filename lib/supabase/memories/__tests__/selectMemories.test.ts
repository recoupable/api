import { beforeEach, describe, expect, it, vi } from "vitest";
import selectMemories from "@/lib/supabase/memories/selectMemories";
import supabase from "@/lib/supabase/serverClient";

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(),
  },
}));

describe("selectMemories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when supabase returns an error", async () => {
    const limit = vi.fn().mockResolvedValue({ data: null, error: { message: "db fail" } });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn(() => ({ eq })) } as never);

    const result = await selectMemories("chat-id", { ascending: true, limit: 10 });

    expect(result).toBeNull();
  });

  it("returns null when an unexpected exception is thrown", async () => {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error("Unexpected failure");
    });

    const result = await selectMemories("chat-id");

    expect(result).toBeNull();
  });

  it("returns memory rows on success", async () => {
    const rows = [
      {
        id: "123e4567-e89b-12d3-a456-426614174000",
        room_id: "123e4567-e89b-12d3-a456-426614174001",
        content: { role: "user", content: "hello" },
        updated_at: "2026-04-01T00:00:00.000Z",
      },
    ];

    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eq = vi.fn(() => ({ order }));
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn(() => ({ eq })) } as never);

    const result = await selectMemories("chat-id", { ascending: true });

    expect(result).toEqual(rows);
  });
});
