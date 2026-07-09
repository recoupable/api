import { describe, it, expect } from "vitest";
import { extractArtistNameFromDatasetItems } from "@/lib/apify/digest/extractArtistNameFromDatasetItems";

describe("extractArtistNameFromDatasetItems", () => {
  it("uses the Instagram profile fullName, falling back to username", () => {
    expect(
      extractArtistNameFromDatasetItems("instagram", [{ fullName: "National Geographic" }]),
    ).toBe("National Geographic");
    expect(extractArtistNameFromDatasetItems("instagram", [{ username: "natgeo" }])).toBe("natgeo");
  });

  it("uses the TikTok author nickName, falling back to handle", () => {
    expect(
      extractArtistNameFromDatasetItems("tiktok", [
        { authorMeta: { name: "natgeo", nickName: "National Geographic" } },
      ]),
    ).toBe("National Geographic");
    expect(extractArtistNameFromDatasetItems("tiktok", [{ authorMeta: { name: "natgeo" } }])).toBe(
      "natgeo",
    );
  });

  it("returns null for unknown platforms or empty items", () => {
    expect(extractArtistNameFromDatasetItems("youtube", [{ some: "shape" }])).toBeNull();
    expect(extractArtistNameFromDatasetItems("instagram", [])).toBeNull();
  });
});
