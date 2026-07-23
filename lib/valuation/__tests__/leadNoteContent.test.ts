import { describe, it, expect } from "vitest";
import { leadNoteContent } from "@/lib/valuation/leadNoteContent";

const lead = {
  email: "artist@example.com",
  artistName: "Mac Miller",
  artistId: "4LLpKhyESsyAXpc4laK94U",
  valueBand: { low: 37_500_000, central: 54_600_000, high: 76_800_000 },
  lifetimeStreams: 22_000_000_000,
  followerCount: 13_000_000,
};

describe("leadNoteContent", () => {
  it("renders a markdown chronology entry with the artist link, value, and signals", () => {
    const c = leadNoteContent(lead, "2026-06-17");
    expect(c).toContain("[Mac Miller](https://open.spotify.com/artist/4LLpKhyESsyAXpc4laK94U)");
    expect(c).toContain("**$54,600,000**");
    expect(c).toContain("$37,500,000–$76,800,000");
    expect(c).toContain("Lifetime streams: 22,000,000,000");
    expect(c).toContain("Followers: 13,000,000");
    expect(c).toContain("Run date: 2026-06-17");
  });

  it("omits the followers line when it is not known", () => {
    const { followerCount: _omit, ...noFollowers } = lead;
    expect(leadNoteContent(noFollowers, "2026-06-17")).not.toContain("Followers:");
  });
});
