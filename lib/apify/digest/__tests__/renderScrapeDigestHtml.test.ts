import { describe, it, expect } from "vitest";
import { renderScrapeDigestHtml } from "@/lib/apify/digest/renderScrapeDigestHtml";

const SECTIONS = [
  {
    platform: "instagram",
    postUrls: ["https://instagram.com/p/abc", "https://instagram.com/p/def"],
  },
  { platform: "tiktok", postUrls: ["https://tiktok.com/@a/video/1"] },
];

describe("renderScrapeDigestHtml", () => {
  it("links every new post, grouped under its platform", () => {
    const { html } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    for (const s of SECTIONS) for (const u of s.postUrls) expect(html).toContain(`href="${u}"`);
    expect(html.toLowerCase()).toContain("instagram");
    expect(html.toLowerCase()).toContain("tiktok");
  });

  it("is deterministic — identical input renders identical output", () => {
    const a = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    const b = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(a).toEqual(b);
  });

  it("never leaks internal vendor jargon to customers", () => {
    const { html, subject } = renderScrapeDigestHtml({
      sections: SECTIONS,
      artistName: "Ashnikko",
    });
    expect((html + subject).toLowerCase()).not.toContain("apify");
    expect((html + subject).toLowerCase()).not.toContain("dataset");
  });

  it("counts posts and platforms in the subject", () => {
    const { subject } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(subject).toBe("Ashnikko: 3 new posts across 2 platforms");
  });
});
