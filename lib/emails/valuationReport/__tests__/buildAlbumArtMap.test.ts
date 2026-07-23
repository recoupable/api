import { describe, it, expect } from "vitest";
import { buildAlbumArtMap } from "../buildAlbumArtMap";

describe("buildAlbumArtMap", () => {
  it("maps lowercased album names to the smallest cover-art url", () => {
    const albums = [
      {
        id: "1",
        name: "Album A",
        images: [
          { url: "big.jpg", height: 640, width: 640 },
          { url: "small.jpg", height: 64, width: 64 },
        ],
      },
      { id: "2", name: "No Art" },
    ];
    const map = buildAlbumArtMap(albums);
    expect(map.get("album a")).toBe("small.jpg");
    expect(map.has("no art")).toBe(false);
  });
});
