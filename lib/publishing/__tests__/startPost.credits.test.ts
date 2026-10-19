import { describe, it, expect, vi } from "vitest";
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

describe("startPost credits", () => {
  it("hands the workflow the price quoted at create time", async () => {
    vi.mocked(insertScheduledPost).mockResolvedValue({ id: "p1", status: "publishing" } as never);
    vi.mocked(start).mockResolvedValue({ runId: "wrun_1" } as never);
    vi.mocked(updateScheduledPost).mockResolvedValue({ id: "p1" } as never);
    await startPost({ accountId: "acct", platform: "x", video_url: "https://v", description: "d" });
    expect(start).toHaveBeenCalledWith(expect.anything(), [
      "p1",
      { accountId: "acct", platform: "x", creditsToCharge: 10_000 },
    ]);
  });
});
