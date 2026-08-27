import { describe, it, expect, vi, beforeEach } from "vitest";
import { getArtistSocials } from "../getArtistSocials";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { selectAccountSocialsCount } from "@/lib/supabase/account_socials/selectAccountSocialsCount";
import { selectSocialSnapshots } from "@/lib/supabase/social_snapshots/selectSocialSnapshots";

vi.mock("@/lib/supabase/account_socials/selectAccountSocials", () => ({
  selectAccountSocials: vi.fn(),
}));
vi.mock("@/lib/supabase/account_socials/selectAccountSocialsCount", () => ({
  selectAccountSocialsCount: vi.fn(),
}));
vi.mock("@/lib/supabase/social_snapshots/selectSocialSnapshots", () => ({
  selectSocialSnapshots: vi.fn(),
}));

const ARTIST_ID = "550e8400-e29b-41d4-a716-446655440000";
const social = (id: string) => ({
  id: `as-${id}`,
  account_id: ARTIST_ID,
  social_id: id,
  social: {
    id,
    username: id,
    profile_url: `instagram.com/${id}`,
    avatar: null,
    bio: null,
    followerCount: 100,
    followingCount: 5,
    region: null,
    updated_at: "2026-08-27T00:00:00Z",
  },
});

describe("getArtistSocials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectAccountSocialsCount).mockResolvedValue(2);
    vi.mocked(selectAccountSocials).mockResolvedValue([social("s1"), social("s2")] as never);
  });

  it("without history: no snapshot query, no history key on the profiles", async () => {
    const result = await getArtistSocials({ artist_account_id: ARTIST_ID, page: 1, limit: 20 });
    expect(selectSocialSnapshots).not.toHaveBeenCalled();
    expect(result.socials[0]).not.toHaveProperty("history");
    expect(result.socials[0]).toMatchObject({ social_id: "s1", follower_count: 100 });
  });

  it("with history: fetches the window for the page's socials and attaches each social's points newest first", async () => {
    vi.mocked(selectSocialSnapshots).mockResolvedValue([
      {
        social_id: "s1",
        captured_at: "2026-08-27T00:00:00Z",
        follower_count: 100,
        following_count: 5,
        post_count: 40,
      },
      {
        social_id: "s1",
        captured_at: "2026-08-20T00:00:00Z",
        follower_count: 90,
        following_count: 5,
        post_count: 39,
      },
      {
        social_id: "s2",
        captured_at: "2026-08-27T00:00:00Z",
        follower_count: 7,
        following_count: null,
        post_count: null,
      },
    ] as never);

    const result = await getArtistSocials({
      artist_account_id: ARTIST_ID,
      page: 1,
      limit: 20,
      history: 14,
    });

    expect(selectSocialSnapshots).toHaveBeenCalledWith({ socialIds: ["s1", "s2"], days: 14 });
    expect(result.socials[0].history).toEqual([
      {
        captured_at: "2026-08-27T00:00:00Z",
        follower_count: 100,
        following_count: 5,
        post_count: 40,
      },
      {
        captured_at: "2026-08-20T00:00:00Z",
        follower_count: 90,
        following_count: 5,
        post_count: 39,
      },
    ]);
    expect(result.socials[1].history).toEqual([
      {
        captured_at: "2026-08-27T00:00:00Z",
        follower_count: 7,
        following_count: null,
        post_count: null,
      },
    ]);
  });

  it("with history: a social with no points gets an empty array, not a missing key", async () => {
    vi.mocked(selectSocialSnapshots).mockResolvedValue([]);
    const result = await getArtistSocials({
      artist_account_id: ARTIST_ID,
      page: 1,
      limit: 20,
      history: 7,
    });
    expect(result.socials.map(s => s.history)).toEqual([[], []]);
  });
});
