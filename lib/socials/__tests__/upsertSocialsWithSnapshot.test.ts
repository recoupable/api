import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertSocialsWithSnapshot } from "../upsertSocialsWithSnapshot";
import { upsertSocials } from "@/lib/supabase/socials/upsertSocials";
import { upsertSocialSnapshots } from "@/lib/supabase/social_snapshots/upsertSocialSnapshots";

vi.mock("@/lib/supabase/socials/upsertSocials", () => ({ upsertSocials: vi.fn() }));
vi.mock("@/lib/supabase/social_snapshots/upsertSocialSnapshots", () => ({
  upsertSocialSnapshots: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(upsertSocialSnapshots).mockResolvedValue([]);
});

describe("upsertSocialsWithSnapshot", () => {
  it("upserts the socials (without the snapshot-only postCount) and writes one snapshot per row with a follower count", async () => {
    vi.mocked(upsertSocials).mockResolvedValue([
      { id: "s1", profile_url: "instagram.com/alice" },
      { id: "s2", profile_url: "instagram.com/bob" },
    ] as never);

    const result = await upsertSocialsWithSnapshot([
      {
        username: "alice",
        profile_url: "instagram.com/alice",
        followerCount: 597,
        followingCount: 6577,
        postCount: 236,
      },
      { username: "bob", profile_url: "instagram.com/bob", followerCount: 12 },
    ]);

    expect(upsertSocials).toHaveBeenCalledWith([
      {
        username: "alice",
        profile_url: "instagram.com/alice",
        followerCount: 597,
        followingCount: 6577,
      },
      { username: "bob", profile_url: "instagram.com/bob", followerCount: 12 },
    ]);
    expect(upsertSocialSnapshots).toHaveBeenCalledWith([
      { social_id: "s1", follower_count: 597, following_count: 6577, post_count: 236 },
      { social_id: "s2", follower_count: 12, following_count: null, post_count: null },
    ]);
    expect(result).toHaveLength(2);
  });

  it("skips the snapshot for rows without a follower count (a commenter row from a comments run)", async () => {
    vi.mocked(upsertSocials).mockResolvedValue([
      { id: "s1", profile_url: "instagram.com/alice" },
    ] as never);

    await upsertSocialsWithSnapshot([{ username: "alice", profile_url: "instagram.com/alice" }]);

    expect(upsertSocialSnapshots).not.toHaveBeenCalled();
  });

  it("matches snapshot rows to socials by profile_url, not by array position", async () => {
    // upsert returns rows in a different order than the input
    vi.mocked(upsertSocials).mockResolvedValue([
      { id: "s2", profile_url: "instagram.com/bob" },
      { id: "s1", profile_url: "instagram.com/alice" },
    ] as never);

    await upsertSocialsWithSnapshot([
      { username: "alice", profile_url: "instagram.com/alice", followerCount: 1 },
      { username: "bob", profile_url: "instagram.com/bob", followerCount: 2 },
    ]);

    expect(upsertSocialSnapshots).toHaveBeenCalledWith([
      { social_id: "s1", follower_count: 1, following_count: null, post_count: null },
      { social_id: "s2", follower_count: 2, following_count: null, post_count: null },
    ]);
  });

  it("does not write snapshots on an empty input", async () => {
    vi.mocked(upsertSocials).mockResolvedValue([]);
    await upsertSocialsWithSnapshot([]);
    expect(upsertSocials).not.toHaveBeenCalled();
    expect(upsertSocialSnapshots).not.toHaveBeenCalled();
  });
});
