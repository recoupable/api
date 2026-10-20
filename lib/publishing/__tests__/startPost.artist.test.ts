import { describe, it, expect, vi, beforeEach } from "vitest";
import { start } from "workflow/api";
import { startPost } from "../startPost";
import { insertScheduledPost } from "@/lib/supabase/scheduled_posts/insertScheduledPost";
import { updateScheduledPost } from "@/lib/supabase/scheduled_posts/updateScheduledPost";

vi.mock("workflow/api", () => ({ start: vi.fn() }));
vi.mock("@/app/workflows/posts/publishPostWorkflow", () => ({ publishPostWorkflow: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_posts/insertScheduledPost", () => ({
  insertScheduledPost: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_posts/updateScheduledPost", () => ({
  updateScheduledPost: vi.fn(),
}));

const post = {
  accountId: "acct",
  platform: "x" as const,
  video_url: "https://v",
  description: "d",
};

describe("startPost artist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(insertScheduledPost).mockResolvedValue({ id: "p1", status: "publishing" } as never);
    vi.mocked(start).mockResolvedValue({ runId: "wrun_1" } as never);
    vi.mocked(updateScheduledPost).mockResolvedValue({ id: "p1" } as never);
  });

  it("stores the artist beside the charged account and charges the account", async () => {
    await startPost({ ...post, artist_account_id: "artist" });
    expect(insertScheduledPost).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: "acct", artist_account_id: "artist" }),
    );
    expect(start).toHaveBeenCalledWith(expect.anything(), [
      "p1",
      expect.objectContaining({ accountId: "acct" }),
    ]);
  });

  it("stores null when the account's own connection posts", async () => {
    await startPost(post);
    expect(insertScheduledPost).toHaveBeenCalledWith(
      expect.objectContaining({ artist_account_id: null }),
    );
  });
});
