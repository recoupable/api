import { describe, it, expect } from "vitest";
import { flattenAccountSocials } from "@/lib/account/flattenAccountSocials";

const rows = [
  {
    id: "account-social-1",
    account_id: "acct-1",
    social_id: "soc-1",
    social: {
      id: "soc-1",
      username: "apache_207",
      profile_url: "tiktok.com/@apache_207",
      avatar: "a",
      bio: "",
      region: "",
      followerCount: 10,
      followingCount: 1,
      updated_at: "t",
    },
  },
] as never;

describe("flattenAccountSocials", () => {
  it("returns social_id (what scrape/sub-resources need) and drops the link-row id", () => {
    const [s] = flattenAccountSocials(rows) as Array<Record<string, unknown>>;
    expect(s.social_id).toBe("soc-1");
    expect(s.username).toBe("apache_207");
    expect(s.id).toBeUndefined(); // account_socials.id used to leak here → scrape 404s on it
  });
});
