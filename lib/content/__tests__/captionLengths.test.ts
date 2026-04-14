import { describe, it, expect } from "vitest";
import { CAPTION_LENGTHS } from "../captionLengths";

describe("CAPTION_LENGTHS", () => {
  it("contains exactly none, short, medium, long", () => {
    expect(CAPTION_LENGTHS).toEqual(["none", "short", "medium", "long"]);
  });
});
