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

const publishAt = "2099-01-01T15:00:00Z";

describe("startPost scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(insertScheduledPost).mockResolvedValue({ id: "p1", status: "scheduled" } as never);
    vi.mocked(start).mockResolvedValue({ runId: "wrun_1" } as never);
    vi.mocked(updateScheduledPost).mockResolvedValue({ id: "p1", status: "scheduled" } as never);
  });

  it("inserts a scheduled row and hands the workflow the publish time", async () => {
    await startPost({
      accountId: "acct",
      platform: "x",
      video_url: "https://v",
      description: "d",
      publish_at: publishAt,
    });
    expect(insertScheduledPost).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scheduled", publish_at: publishAt }),
    );
    expect(start).toHaveBeenCalledWith(expect.anything(), [
      "p1",
      expect.objectContaining({ publishAt }),
    ]);
  });

  it("inserts a publishing row with no publish time when publish_at is omitted", async () => {
    await startPost({ accountId: "acct", platform: "x", video_url: "https://v", description: "d" });
    expect(insertScheduledPost).toHaveBeenCalledWith(
      expect.objectContaining({ status: "publishing", publish_at: null }),
    );
    expect(start).toHaveBeenCalledWith(expect.anything(), [
      "p1",
      expect.not.objectContaining({ publishAt: expect.anything() }),
    ]);
  });
});
