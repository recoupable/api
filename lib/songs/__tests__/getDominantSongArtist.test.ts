import { describe, it, expect } from "vitest";

import { getDominantSongArtist } from "../getDominantSongArtist";

const link = (artist: string) => ({ artist });

describe("getDominantSongArtist", () => {
  it("returns null for no links", () => {
    expect(getDominantSongArtist([])).toBeNull();
  });

  it("returns the only linked artist", () => {
    expect(getDominantSongArtist([link("a1"), link("a1")])).toBe("a1");
  });

  it("returns the artist with the most song links (canonical over collaborators)", () => {
    // Mirrors the chat#1850 repro: 67 links to the canonical, 3 one-song collaborators.
    const links = [
      ...Array.from({ length: 5 }, () => link("canonical")),
      link("collab-1"),
      link("collab-2"),
    ];

    expect(getDominantSongArtist(links)).toBe("canonical");
  });

  it("breaks count ties deterministically (lowest artist id)", () => {
    expect(getDominantSongArtist([link("b"), link("a")])).toBe("a");
    expect(getDominantSongArtist([link("a"), link("b")])).toBe("a");
  });

  it("ignores rows without an artist", () => {
    expect(getDominantSongArtist([{ artist: null as unknown as string }])).toBeNull();
  });
});
