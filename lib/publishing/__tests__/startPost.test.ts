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

const row = { id: "p1", status: "publishing" };

describe("startPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(insertScheduledPost).mockResolvedValue(row as never);
    vi.mocked(start).mockResolvedValue({ runId: "wrun_1" } as never);
    vi.mocked(updateScheduledPost).mockResolvedValue({
      ...row,
      workflow_run_id: "wrun_1",
    } as never);
  });

  it("inserts a publishing row with nulls for omitted fields, then starts the workflow", async () => {
    const result = await startPost({
      accountId: "acct",
      platform: "x",
      video_url: "https://v",
      description: "d",
    });
    expect(insertScheduledPost).toHaveBeenCalledWith({
      account_id: "acct",
      platform: "x",
      sub_account_id: null,
      video_url: "https://v",
      cover_url: null,
      title: null,
      description: "d",
      privacy: null,
      tags: null,
      publish_at: null,
      status: "publishing",
    });
    expect(start).toHaveBeenCalledWith(expect.anything(), ["p1", expect.any(Object)]);
    expect(result).toMatchObject({ workflow_run_id: "wrun_1" });
  });

  it("returns the row when recording the run id fails", async () => {
    vi.mocked(updateScheduledPost).mockRejectedValue(new Error("db blip"));
    expect(
      await startPost({
        accountId: "acct",
        platform: "x",
        video_url: "https://v",
        description: "d",
      }),
    ).toBe(row);
  });
});
