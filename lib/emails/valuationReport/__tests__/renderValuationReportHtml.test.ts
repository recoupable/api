import { describe, it, expect } from "vitest";
import { renderValuationReportHtml } from "../renderValuationReportHtml";

const baseParams = {
  catalogName: "Epitaph 10-Album Catalog",
  deepLinkUrl: "https://chat.recoupable.dev/catalogs/cat_1",
  albumCount: 10,
  valuation: { low: 7_200, mid: 10_400, high: 14_100 },
  totalStreams: 3_480_000,
  measuredSongCount: 112,
  catalogAgeYears: 5,
};

describe("renderValuationReportHtml", () => {
  it("uses the fixed subject line", () => {
    const { subject } = renderValuationReportHtml(baseParams);
    expect(subject).toBe("Your catalog valuation is ready");
  });

  it("renders catalog name, headline value, range, streams, and counts", () => {
    const { html } = renderValuationReportHtml(baseParams);
    expect(html).toContain("Epitaph 10-Album Catalog");
    expect(html).toContain("$10.4K");
    expect(html).toContain("$7.2K to $14.1K");
    expect(html).toContain("3.5M");
    expect(html).toContain("112");
    expect(html).toContain("10");
  });

  it("links the CTA to the deep link", () => {
    const { html } = renderValuationReportHtml(baseParams);
    expect(html).toContain('href="https://chat.recoupable.dev/catalogs/cat_1"');
  });

  it("escapes HTML in the catalog name", () => {
    const { html } = renderValuationReportHtml({
      ...baseParams,
      catalogName: '<img src="x">Catalog',
    });
    expect(html).not.toContain('<img src="x">');
    expect(html).toContain("&lt;img src=&quot;x&quot;&gt;Catalog");
  });

  it("omits the valuation and streams rows when no measurements are available", () => {
    const { html } = renderValuationReportHtml({
      catalogName: null,
      deepLinkUrl: "https://chat.recoupable.dev",
      albumCount: 4,
    });
    expect(html).not.toContain("Estimated value");
    expect(html).not.toContain("Lifetime Spotify streams");
    expect(html).toContain("Your catalog");
    expect(html).toContain('href="https://chat.recoupable.dev"');
    expect(html).toContain("4");
  });

  it("contains no em or en dashes in outward-facing copy", () => {
    const { html, subject } = renderValuationReportHtml(baseParams);
    expect(subject).not.toMatch(/[–—]/);
    expect(html).not.toMatch(/[–—]/);
  });
});
