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

const post = { id: "p1", account_id: "acct", artist_account_id: "artist", platform: "x" };

describe("publishPostStep artist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectScheduledPosts).mockResolvedValue([post] as never);
    vi.mocked(findConnectedAccountId).mockResolvedValue("ca_x");
    vi.mocked(publishToPlatform).mockResolvedValue({
      postUrl: "https://x.com/a",
      textVerified: true,
    });
  });

  it("publishes through the artist's connection", async () => {
    await publishPostStep("p1");
    expect(findConnectedAccountId).toHaveBeenCalledWith("artist", "x");
    expect(publishToPlatform).toHaveBeenCalledWith({
      target: { accountId: "artist", connectedAccountId: "ca_x" },
      post,
    });
  });
});
