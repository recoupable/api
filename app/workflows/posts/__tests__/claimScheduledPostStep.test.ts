import { describe, it, expect, vi } from "vitest";
import { claimScheduledPostStep } from "../claimScheduledPostStep";
import { updateScheduledPostIfStatus } from "@/lib/supabase/scheduled_posts/updateScheduledPostIfStatus";

vi.mock("@/lib/supabase/scheduled_posts/updateScheduledPostIfStatus", () => ({
  updateScheduledPostIfStatus: vi.fn(),
}));

describe("claimScheduledPostStep", () => {
  it("moves a still-scheduled post to publishing", async () => {
    vi.mocked(updateScheduledPostIfStatus).mockResolvedValue({ id: "p1" } as never);
    expect(await claimScheduledPostStep("p1")).toBe(true);
    expect(updateScheduledPostIfStatus).toHaveBeenCalledWith("p1", "scheduled", {
      status: "publishing",
    });
  });

  it("claims nothing when the post is no longer scheduled", async () => {
    vi.mocked(updateScheduledPostIfStatus).mockResolvedValue(null);
    expect(await claimScheduledPostStep("p1")).toBe(false);
  });
});
