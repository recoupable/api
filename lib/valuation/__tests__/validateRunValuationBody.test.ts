import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateRunValuationBody } from "@/lib/valuation/validateRunValuationBody";

describe("validateRunValuationBody", () => {
  it("accepts a body with a spotify_artist_id", () => {
    const result = validateRunValuationBody({ spotify_artist_id: "0xPoV" });
    expect(result).toEqual({ spotify_artist_id: "0xPoV" });
  });

  it("400s when spotify_artist_id is missing", () => {
    const result = validateRunValuationBody({});
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("400s when spotify_artist_id is empty or not a string", () => {
    expect(validateRunValuationBody({ spotify_artist_id: "" })).toBeInstanceOf(NextResponse);
    expect(validateRunValuationBody({ spotify_artist_id: 5 })).toBeInstanceOf(NextResponse);
    expect(validateRunValuationBody(null)).toBeInstanceOf(NextResponse);
  });
});
