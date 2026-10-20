import { beforeEach, describe, expect, it, vi } from "vitest";
import { getArtistFans } from "../getArtistFans";
const mocks = vi.hoisted(() => ({ socials: vi.fn(), fans: vi.fn() }));
vi.mock("@/lib/supabase/account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: mocks.socials,
}));
vi.mock("@/lib/supabase/social_fans/selectSocialFans", () => ({ selectSocialFans: mocks.fans }));
const fan = {
  id: "fan_fixture",
  username: "fan",
  followerCount: 12,
  followingCount: 4,
  updated_at: "2099-01-01T00:00:00Z",
};
const comment = { id: "comment_fixture", social_id: fan.id, commented_at: "2026-10-01T12:00:00Z" };
const params = { artistAccountId: "artist_fixture", page: 2, limit: 10 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.socials.mockResolvedValue(["artist_social_fixture"]);
  mocks.fans.mockResolvedValue({
    rows: [{ fan_social: fan, latest_engagement_comment: comment }],
    totalCount: 11,
  });
});
describe("stored comment recency in the existing fans response", () => {
  it("returns the stored comment time, retaining profile fields and pagination", async () => {
    const result = await getArtistFans(params);
    expect(result).toEqual({
      status: "success",
      fans: [
        {
          id: fan.id,
          username: fan.username,
          updated_at: fan.updated_at,
          follower_count: 12,
          following_count: 4,
          last_comment_at: comment.commented_at,
        },
      ],
      pagination: { total_count: 11, page: 2, limit: 10, total_pages: 2 },
    });
    expect(mocks.socials).toHaveBeenCalledWith(params.artistAccountId);
    expect(mocks.fans).toHaveBeenCalledExactlyOnceWith({
      social_ids: ["artist_social_fixture"],
      orderBy: "latest_engagement",
      orderDirection: "desc",
      page: 2,
      limit: 10,
    });
  });
  it.each([null, [], [{ ...comment, social_id: "another_fan" }]])(
    "returns null for absent or mismatched comment evidence: %j",
    async evidence => {
      mocks.fans.mockResolvedValue({
        rows: [
          {
            fan_social: fan,
            latest_engagement_comment: evidence,
            latest_engagement: "2099-01-01T00:00:00Z",
          },
        ],
        totalCount: 1,
      });
      expect((await getArtistFans(params)).fans[0].last_comment_at).toBeNull();
    },
  );
  it("handles the joined array shape without detaching dates from their fans", async () => {
    mocks.fans.mockResolvedValue({
      rows: [
        { fan_social: [fan], latest_engagement_comment: [comment] },
        { fan_social: [{ ...fan, id: "second_fan" }], latest_engagement_comment: [] },
        { fan_social: null, latest_engagement_comment: comment },
      ],
      totalCount: 3,
    });
    const result = await getArtistFans(params);
    expect(result.fans.map(value => [value.id, value.last_comment_at])).toEqual([
      [fan.id, comment.commented_at],
      ["second_fan", null],
    ]);
  });
  it("propagates lookup failure instead of returning guessed recency", async () => {
    mocks.socials.mockRejectedValue(new Error("database unavailable"));
    await expect(getArtistFans(params)).rejects.toThrow("database unavailable");
    expect(mocks.fans).not.toHaveBeenCalled();
  });
});
