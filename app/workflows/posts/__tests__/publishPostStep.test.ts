import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishPostStep } from "../publishPostStep";
import { selectScheduledPosts } from "@/lib/supabase/scheduled_posts/selectScheduledPosts";
import { findConnectedAccountId } from "@/lib/publishing/findConnectedAccountId";
import { publishToPlatform } from "@/lib/publishing/publish/publishToPlatform";

vi.mock("@/lib/supabase/scheduled_posts/selectScheduledPosts", () => ({
  selectScheduledPosts: vi.fn(),
}));
vi.mock("@/lib/publishing/findConnectedAccountId", () => ({ findConnectedAccountId: vi.fn() }));
vi.mock("@/lib/publishing/publish/publishToPlatform", () => ({ publishToPlatform: vi.fn() }));

const post = { id: "p1", account_id: "acct", platform: "instagram" };

describe("publishPostStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectScheduledPosts).mockResolvedValue([post] as never);
    vi.mocked(findConnectedAccountId).mockResolvedValue("ca_ig");
    vi.mocked(publishToPlatform).mockResolvedValue({
      postUrl: "https://www.instagram.com/reel/a/",
      textVerified: true,
    });
  });

  it("is never retried, so a partial success cannot publish twice", () => {
    expect((publishPostStep as unknown as { maxRetries: number }).maxRetries).toBe(0);
  });

  it("publishes through the account's own connection", async () => {
    await publishPostStep("p1");
    expect(findConnectedAccountId).toHaveBeenCalledWith("acct", "instagram");
    expect(publishToPlatform).toHaveBeenCalledWith({
      target: { accountId: "acct", connectedAccountId: "ca_ig" },
      post,
    });
  });

  it("fails without publishing when the connection is gone", async () => {
    vi.mocked(findConnectedAccountId).mockResolvedValue(null);
    await expect(publishPostStep("p1")).rejects.toThrow("instagram is not connected");
    expect(publishToPlatform).not.toHaveBeenCalled();
  });
});
