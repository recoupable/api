import { describe, expect, it } from "vitest";
import { extractValuationAlbums } from "@/lib/valuation/extractValuationAlbums";

const items = [
  { id: "alb2", release_date: "2022-05-01" },
  { id: "alb1", release_date: "2019-01-10" },
  { id: "alb3", release_date: "2023-11-20" },
];

describe("extractValuationAlbums", () => {
  it("returns the album ids and the earliest release date", () => {
    expect(extractValuationAlbums(items)).toEqual({
      albumIds: ["alb2", "alb1", "alb3"],
      earliestReleaseDate: "2019-01-10",
    });
  });

  it("dedupes album ids", () => {
    const dupes = [...items, { id: "alb1", release_date: "2019-01-10" }];
    expect(extractValuationAlbums(dupes).albumIds).toEqual(["alb2", "alb1", "alb3"]);
  });

  it("handles no albums (null earliest, empty ids)", () => {
    expect(extractValuationAlbums([])).toEqual({ albumIds: [], earliestReleaseDate: null });
  });
});
