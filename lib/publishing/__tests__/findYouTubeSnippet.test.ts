import { describe, it, expect } from "vitest";
import { findYouTubeSnippet } from "../findYouTubeSnippet";

describe("findYouTubeSnippet", () => {
  it("finds the first item's snippet under nested envelopes", () => {
    expect(
      findYouTubeSnippet({ result: { data: { items: [{ snippet: { title: "T" } }] } } }),
    ).toEqual({ title: "T" });
  });

  it("returns null when there are no items", () => {
    expect(findYouTubeSnippet({ data: {} })).toBeNull();
  });
});
