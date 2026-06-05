import { describe, expect, it } from "vitest";

import { isNoisyCatalogTitle } from "../isNoisyCatalogTitle";

describe("isNoisyCatalogTitle", () => {
  it("flags feat and remix patterns", () => {
    expect(isNoisyCatalogTitle("Nice For What feat. Lil Wayne")).toBe(true);
    expect(isNoisyCatalogTitle("Hotline Bling (Remix)")).toBe(true);
  });

  it("does not flag legitimate titles containing with", () => {
    expect(isNoisyCatalogTitle("Dance With Me")).toBe(false);
    expect(isNoisyCatalogTitle("God's Plan")).toBe(false);
  });
});
