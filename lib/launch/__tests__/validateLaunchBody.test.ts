import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validateLaunchBody } from "../validateLaunchBody";

/**
 * Remove a key from an object — test utility.
 *
 * @param obj - Source object
 * @param key - Key to remove
 * @returns Object without the specified key
 */
function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

describe("validateLaunchBody", () => {
  const validBody = {
    artist_name: "Gliiico",
    song_name: "Midnight Drive",
    genre: "Indie Pop",
    release_date: "2026-04-01",
    description: "A song about late night drives and nostalgia",
  };

  describe("successful cases", () => {
    it("returns parsed body when all required fields are present", () => {
      const result = validateLaunchBody(validBody);
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.artist_name).toBe("Gliiico");
        expect(result.song_name).toBe("Midnight Drive");
        expect(result.genre).toBe("Indie Pop");
        expect(result.release_date).toBe("2026-04-01");
        expect(result.description).toBe("A song about late night drives and nostalgia");
      }
    });

    it("accepts body without optional description", () => {
      const result = validateLaunchBody(omit(validBody, "description"));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (!(result instanceof NextResponse)) {
        expect(result.description).toBeUndefined();
      }
    });
  });

  describe("error cases", () => {
    it("returns 400 when artist_name is missing", () => {
      const result = validateLaunchBody(omit(validBody, "artist_name"));
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when song_name is missing", () => {
      const result = validateLaunchBody(omit(validBody, "song_name"));
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when genre is missing", () => {
      const result = validateLaunchBody(omit(validBody, "genre"));
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when release_date is missing", () => {
      const result = validateLaunchBody(omit(validBody, "release_date"));
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when artist_name is empty string", () => {
      const result = validateLaunchBody({ ...validBody, artist_name: "" });
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });

    it("returns 400 when body is null", () => {
      const result = validateLaunchBody(null);
      expect(result).toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) {
        expect(result.status).toBe(400);
      }
    });
  });
});
