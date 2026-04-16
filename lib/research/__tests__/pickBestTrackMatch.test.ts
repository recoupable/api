import { describe, it, expect } from "vitest";
import { pickBestTrackMatch, type SearchTrack } from "../pickBestTrackMatch";

const drakeHotline: SearchTrack = {
  id: 1,
  name: "Hotline Bling",
  artist_names: ["Drake"],
};
const blingCover: SearchTrack = {
  id: 2,
  name: "Bling",
  artist_names: ["T703R"],
};
const drakeGodsPlan: SearchTrack = {
  id: 3,
  name: "God's Plan",
  artist_names: ["Drake"],
};
const godsOnly: SearchTrack = {
  id: 4,
  name: "God's",
  artist_names: ["bobby fox"],
};

describe("pickBestTrackMatch", () => {
  describe("without artist filter", () => {
    it("returns the first track when no exact-name match is found", () => {
      const result = pickBestTrackMatch({
        tracks: [blingCover, drakeHotline],
        q: "Something unrelated",
      });
      expect(result).toBe(blingCover);
    });

    it("prefers an exact case-insensitive name match over the first entry", () => {
      const result = pickBestTrackMatch({
        tracks: [godsOnly, drakeGodsPlan],
        q: "god's plan",
      });
      expect(result).toBe(drakeGodsPlan);
    });

    it("returns undefined when the pool is empty", () => {
      expect(pickBestTrackMatch({ tracks: [], q: "Flowers" })).toBeUndefined();
    });
  });

  describe("with artist filter", () => {
    it("keeps only tracks whose artist_names contain the artist (case-insensitive)", () => {
      const result = pickBestTrackMatch({
        tracks: [blingCover, drakeHotline],
        q: "Hotline Bling",
        artist: "drake",
      });
      expect(result).toBe(drakeHotline);
    });

    it("returns undefined when no track matches the artist filter", () => {
      const result = pickBestTrackMatch({
        tracks: [blingCover, godsOnly],
        q: "God's Plan",
        artist: "Drake",
      });
      expect(result).toBeUndefined();
    });

    it("still applies exact-name-match ranking within the artist-filtered pool", () => {
      const drakeGodsRemix: SearchTrack = {
        id: 5,
        name: "God's Plan (Remix)",
        artist_names: ["Drake", "Someone"],
      };
      const result = pickBestTrackMatch({
        tracks: [drakeGodsRemix, drakeGodsPlan],
        q: "God's Plan",
        artist: "Drake",
      });
      expect(result).toBe(drakeGodsPlan);
    });

    it("matches artist names via substring (e.g. 'Horizon' matches 'Bring Me The Horizon')", () => {
      const bmth: SearchTrack = {
        id: 6,
        name: "Can You Feel My Heart",
        artist_names: ["Bring Me The Horizon"],
      };
      const result = pickBestTrackMatch({
        tracks: [bmth],
        q: "Can You Feel My Heart",
        artist: "horizon",
      });
      expect(result).toBe(bmth);
    });

    it("handles tracks missing artist_names by filtering them out", () => {
      const noArtists: SearchTrack = { id: 7, name: "Flowers" };
      const miley: SearchTrack = {
        id: 8,
        name: "Flowers",
        artist_names: ["Miley Cyrus"],
      };
      const result = pickBestTrackMatch({
        tracks: [noArtists, miley],
        q: "Flowers",
        artist: "Miley Cyrus",
      });
      expect(result).toBe(miley);
    });
  });
});
