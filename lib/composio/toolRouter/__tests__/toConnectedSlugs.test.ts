import { describe, it, expect } from "vitest";
import { toConnectedSlugs } from "../toConnectedSlugs";

describe("toConnectedSlugs", () => {
  it("returns only slugs whose connector isConnected=true", () => {
    const result = toConnectedSlugs([
      { slug: "tiktok", name: "TikTok", isConnected: true, connectedAccountId: "ca_tt" },
      { slug: "googledrive", name: "Google Drive", isConnected: false },
      { slug: "googledocs", name: "Google Docs", isConnected: true, connectedAccountId: "ca_d" },
    ]);

    expect(result).toEqual(new Set(["tiktok", "googledocs"]));
  });

  it("returns an empty set when no connectors are connected", () => {
    const result = toConnectedSlugs([
      { slug: "tiktok", name: "TikTok", isConnected: false },
      { slug: "googledocs", name: "Google Docs", isConnected: false },
    ]);

    expect(result).toEqual(new Set());
  });

  it("returns an empty set for an empty input", () => {
    expect(toConnectedSlugs([])).toEqual(new Set());
  });
});
