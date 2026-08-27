import { describe, it, expect, vi, beforeEach } from "vitest";
import supabase from "../../serverClient";
import { upsertPosts } from "../upsertPosts";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

describe("upsertPosts", () => {
  it("merges on post_url so a re-scrape refreshes engagement instead of being ignored", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);

    const rows = [{ post_url: "u1", updated_at: "t", views: 5 }];
    await upsertPosts(rows);

    expect(supabase.from).toHaveBeenCalledWith("posts");
    expect(upsert).toHaveBeenCalledWith(rows, { onConflict: "post_url" });
  });

  it("throws on a database error", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.mocked(supabase.from).mockReturnValue({ upsert } as never);
    await expect(upsertPosts([{ post_url: "u1" }])).rejects.toEqual({ message: "boom" });
  });
});
