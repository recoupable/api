import { describe, it, expect } from "vitest";
import { leadAttributes } from "@/lib/valuation/leadAttributes";

const lead = {
  email: "artist@example.com",
  artistName: "Mac Miller",
  artistId: "4LLpKhyESsyAXpc4laK94U",
  valueBand: { low: 37_500_000, central: 54_600_000, high: 76_800_000 },
  lifetimeStreams: 22_000_000_000,
  followerCount: 13_000_000,
};

describe("leadAttributes", () => {
  it("maps the lead to Attio Person attribute values", () => {
    const v = leadAttributes(lead, "2026-06-17");
    expect(v.email_addresses).toEqual([{ email_address: "artist@example.com" }]);
    expect(v.lead_source).toBe("Catalog Valuation");
    expect(v.est_catalog_value).toBe(54_600_000); // band central = lead score
    expect(v.looked_up_artist).toBe("Mac Miller");
    expect(v.spotify_artist_url).toBe("https://open.spotify.com/artist/4LLpKhyESsyAXpc4laK94U");
    expect(v.lifetime_streams).toBe(22_000_000_000);
    expect(v.follower_count).toBe(13_000_000);
    expect(v.valued_at).toBe("2026-06-17");
  });

  it("omits follower_count when it is not known", () => {
    const { followerCount: _omit, ...noFollowers } = lead;
    expect(leadAttributes(noFollowers, "2026-06-17")).not.toHaveProperty("follower_count");
  });

  it("rounds est_catalog_value to a whole number (Attio currency rejects >4 decimals)", () => {
    const fractional = { ...lead, valueBand: { low: 1, central: 33_512_367.0588, high: 2 } };
    expect(leadAttributes(fractional, "2026-06-17").est_catalog_value).toBe(33_512_367);
  });
});
