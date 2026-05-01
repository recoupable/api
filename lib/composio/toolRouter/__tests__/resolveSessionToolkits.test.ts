import { describe, it, expect } from "vitest";
import { resolveSessionToolkits } from "../resolveSessionToolkits";

describe("resolveSessionToolkits", () => {
  const enabledToolkits = ["googlesheets", "googledrive", "googledocs", "tiktok", "instagram"];

  it("gives customer all enabled toolkits so meta-tools can discover them", () => {
    const result = resolveSessionToolkits({
      enabledToolkits,
      customerConnectedSlugs: new Set(),
      artistConnectedSlugs: new Set(),
      sharedConnectedSlugs: new Set(),
    });

    expect(result.customer).toEqual(enabledToolkits);
  });

  it("returns no artist or shared toolkits when neither has any connections", () => {
    const result = resolveSessionToolkits({
      enabledToolkits,
      customerConnectedSlugs: new Set(),
      artistConnectedSlugs: new Set(),
      sharedConnectedSlugs: new Set(),
    });

    expect(result.artist).toEqual([]);
    expect(result.shared).toEqual([]);
  });

  it("gives artist session only toolkits customer has not connected", () => {
    const result = resolveSessionToolkits({
      enabledToolkits,
      customerConnectedSlugs: new Set(["tiktok"]),
      artistConnectedSlugs: new Set(["tiktok", "instagram"]),
      sharedConnectedSlugs: new Set(),
    });

    expect(result.artist).toEqual(["instagram"]);
  });

  it("gives shared session only toolkits neither customer nor artist has", () => {
    const result = resolveSessionToolkits({
      enabledToolkits,
      customerConnectedSlugs: new Set(["googledrive"]),
      artistConnectedSlugs: new Set(["googledocs"]),
      sharedConnectedSlugs: new Set(["googledocs", "googledrive", "googlesheets"]),
    });

    expect(result.shared).toEqual(["googlesheets"]);
  });

  it("returns empty artist when every artist toolkit overlaps with customer", () => {
    const result = resolveSessionToolkits({
      enabledToolkits,
      customerConnectedSlugs: new Set(["tiktok", "instagram"]),
      artistConnectedSlugs: new Set(["tiktok", "instagram"]),
      sharedConnectedSlugs: new Set(),
    });

    expect(result.artist).toEqual([]);
  });

  it("returns empty shared when every shared toolkit is covered by customer or artist", () => {
    const result = resolveSessionToolkits({
      enabledToolkits,
      customerConnectedSlugs: new Set(["googledocs"]),
      artistConnectedSlugs: new Set(["googledrive", "googlesheets"]),
      sharedConnectedSlugs: new Set(["googledocs", "googledrive", "googlesheets"]),
    });

    expect(result.shared).toEqual([]);
  });

  it("passes through artist and shared toolkits when there is no overlap with customer", () => {
    const result = resolveSessionToolkits({
      enabledToolkits,
      customerConnectedSlugs: new Set(),
      artistConnectedSlugs: new Set(["tiktok"]),
      sharedConnectedSlugs: new Set(["googledocs", "googlesheets"]),
    });

    expect(result.artist).toEqual(["tiktok"]);
    expect(result.shared).toEqual(["googlesheets", "googledocs"]);
  });

  it("ignores artist or shared toolkits not in enabledToolkits", () => {
    const result = resolveSessionToolkits({
      enabledToolkits: ["tiktok"],
      customerConnectedSlugs: new Set(),
      artistConnectedSlugs: new Set(["tiktok", "youtube"]),
      sharedConnectedSlugs: new Set(["googledocs"]),
    });

    expect(result.artist).toEqual(["tiktok"]);
    expect(result.shared).toEqual([]);
  });
});
