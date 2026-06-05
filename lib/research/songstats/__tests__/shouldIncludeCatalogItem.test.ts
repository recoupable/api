import { describe, expect, it } from "vitest";

import { shouldIncludeCatalogItem } from "../shouldIncludeCatalogItem";

describe("shouldIncludeCatalogItem", () => {
  it("includes all records when non-primary catalog is requested", () => {
    expect(shouldIncludeCatalogItem({ title: "Remix feat. Guest" }, true)).toBe(true);
  });

  it("excludes remix and feature titles for primary-only catalog", () => {
    expect(shouldIncludeCatalogItem({ title: "God's Plan" }, false)).toBe(true);
    expect(shouldIncludeCatalogItem({ title: "Hotline Bling (Remix)" }, false)).toBe(false);
    expect(shouldIncludeCatalogItem({ title: "Nice For What feat. Lil Wayne" }, false)).toBe(false);
  });

  it("excludes platform shells without title or track id", () => {
    expect(
      shouldIncludeCatalogItem({ source: "spotify", metric_options: ["popularity"] }, false),
    ).toBe(false);
  });

  it("excludes rows flagged as remix or feature by the provider", () => {
    expect(shouldIncludeCatalogItem({ title: "Track", is_remix: true }, false)).toBe(false);
    expect(shouldIncludeCatalogItem({ title: "Track", is_feature: "true" }, false)).toBe(false);
  });
});
