import { describe, expect, it } from "vitest";
import { getFormattedArtist, type ArtistQueryRow } from "../getFormattedArtist";

type SocialJoin = NonNullable<ArtistQueryRow["account_socials"]>[number];

const profile: NonNullable<SocialJoin["social"]> = {
  id: "social-1",
  username: "river",
  profile_url: "https://instagram.com/river",
  avatar: null,
  bio: "Creator bio",
  followerCount: 100,
  followingCount: 20,
  region: null,
  updated_at: "2026-10-22T00:00:00Z",
};

function join(social: SocialJoin["social"]): SocialJoin {
  return {
    id: `join-${social?.id ?? "missing"}`,
    account_id: "creator-1",
    social_id: social?.id ?? "missing-social",
    social,
  };
}

describe("getFormattedArtist social joins", () => {
  it("omits null joins instead of returning incomplete social entries", () => {
    const result = getFormattedArtist({ id: "creator-1", account_socials: [join(null)] });
    expect(result.account_socials).toEqual([]);
    expect(result.id).toBe("creator-1");
    expect(result.account_id).toBe("creator-1");
  });

  it("preserves valid profile fields and order while skipping null joins", () => {
    const second = { ...profile, id: "social-2", profile_url: "https://x.com/river" };
    const row = {
      id: "creator-1",
      account_socials: [join(null), join(profile), join(null), join(second)],
    };
    const before = structuredClone(row);
    expect(getFormattedArtist(row).account_socials).toEqual([
      { ...profile, link: profile.profile_url, type: "INSTAGRAM" },
      { ...second, link: second.profile_url, type: "TWITTER" },
    ]);
    expect(row).toEqual(before);
  });

  it("also filters joined rows wrapped in artist_info without changing pin or identity", () => {
    const result = getFormattedArtist({
      artist_info: {
        id: "creator-1",
        name: "River",
        timestamp: null,
        account_info: [],
        account_socials: [join(null), join(profile)],
      },
      pinned: true,
    });
    expect(result.account_socials).toEqual([
      { ...profile, link: profile.profile_url, type: "INSTAGRAM" },
    ]);
    expect(result).toMatchObject({
      id: "creator-1",
      account_id: "creator-1",
      name: "River",
      pinned: true,
    });
  });

  it("retains an existing profile even when its URL is empty", () => {
    const emptyUrl = { ...profile, profile_url: "" };
    expect(getFormattedArtist({ account_socials: [join(emptyUrl)] }).account_socials).toEqual([
      { ...emptyUrl, link: "", type: "NONE" },
    ]);
  });

  it("keeps missing and empty social arrays empty", () => {
    expect(getFormattedArtist({}).account_socials).toEqual([]);
    expect(getFormattedArtist({ account_socials: [] }).account_socials).toEqual([]);
  });
});
