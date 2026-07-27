import { describe, it, expect } from "vitest";
import { renderValuationReportHtml } from "../renderValuationReportHtml";

const baseParams = {
  catalogName: "Epitaph 10-Album Catalog",
  deepLinkUrl: "https://chat.recoupable.dev/catalogs/cat_1",
  albumCount: 10,
  artist: {
    name: "Nova",
    imageUrl: "https://i.scdn.co/image/artist.jpg",
    followers: 1_240_000,
  },
  valuation: { low: 7_200, mid: 10_400, high: 14_100 },
  totalStreams: 3_480_000,
  measuredSongCount: 112,
  releaseCount: 3,
  catalogAgeYears: 5,
  releases: [
    {
      album: "Album B",
      artistNames: ["Nova"],
      streams: 2_500_000,
      value: 7_471,
      artUrl: "https://i.scdn.co/image/albumB.jpg",
    },
    {
      album: "Album A",
      artistNames: ["Nova", "Guest"],
      streams: 980_000,
      value: 2_929,
      artUrl: null,
    },
  ],
};

describe("renderValuationReportHtml", () => {
  it("uses the fixed subject line", () => {
    expect(renderValuationReportHtml(baseParams).subject).toBe("Your catalog valuation is ready");
  });

  it("renders catalog name, headline value, range, streams, and counts", () => {
    const { html } = renderValuationReportHtml(baseParams);
    expect(html).toContain("Epitaph 10-Album Catalog");
    expect(html).toContain("Estimated catalog value");
    expect(html).toContain("$10.4K");
    expect(html).toContain("Range $7.2K to $14.1K");
    expect(html).toContain("3.5M"); // lifetime streams
    expect(html).toContain("112"); // tracks measured
    expect(html).toContain("Releases");
    expect(html).toContain("5 years"); // catalog age
  });

  it("renders the artist header with image and follower count", () => {
    const { html } = renderValuationReportHtml(baseParams);
    expect(html).toContain('src="https://i.scdn.co/image/artist.jpg"');
    expect(html).toContain(">Nova<");
    expect(html).toContain("1.2M followers");
  });

  it("renders a release table row with art, name, streams, and proportional value", () => {
    const { html } = renderValuationReportHtml(baseParams);
    expect(html).toContain('src="https://i.scdn.co/image/albumB.jpg"');
    expect(html).toContain("Album B");
    expect(html).toContain("Album A");
    expect(html).toContain("Nova, Guest"); // multi-artist row
    expect(html).toContain("2.5M"); // release streams
    expect(html).toContain("$7.5K"); // release value (7471 -> 7.5K)
    expect(html).toContain("$2.9K"); // release value (2929 -> 2.9K)
  });

  it("shows the directional-model disclaimer when valued", () => {
    const { html } = renderValuationReportHtml(baseParams);
    expect(html).toContain("Directional model, not an appraisal");
    expect(html).toContain("10 to 16x");
  });

  it("links the CTA to the deep link with the full-report copy", () => {
    const { html } = renderValuationReportHtml(baseParams);
    expect(html).toContain('href="https://chat.recoupable.dev/catalogs/cat_1"');
    expect(html).toContain("Get the full report with Recoup");
  });

  it("escapes HTML in the catalog name", () => {
    const { html } = renderValuationReportHtml({
      ...baseParams,
      catalogName: '<img src="x">Catalog',
    });
    expect(html).not.toContain('<img src="x">Catalog');
    expect(html).toContain("&lt;img src=&quot;x&quot;&gt;Catalog");
  });

  it("degrades to a link-only email when no measurements are available", () => {
    const { html } = renderValuationReportHtml({
      catalogName: null,
      deepLinkUrl: "https://chat.recoupable.dev",
      albumCount: 4,
    });
    expect(html).not.toContain("Estimated catalog value");
    expect(html).not.toContain("Directional model");
    expect(html).toContain("Your catalog");
    expect(html).toContain('href="https://chat.recoupable.dev"');
  });

  it("contains no em or en dashes in outward-facing copy", () => {
    const { html, subject } = renderValuationReportHtml(baseParams);
    expect(subject).not.toMatch(/[–—]/);
    expect(html).not.toMatch(/[–—]/);
  });

  it("renders inside the shared house layout (consistency pass)", () => {
    const { html } = renderValuationReportHtml(baseParams);

    // Shared wrapper markers: the house footer tagline + shadow-as-border card.
    expect(html).toContain("the AI agent platform for the music industry");
    expect(html).toContain("box-shadow: 0px 0px 0px 1px #e8e8e8");
    // The email no longer ships its own outer page/card chrome.
    expect(html).not.toContain("background:#f7f7f7;padding:24px 0");
  });
});
