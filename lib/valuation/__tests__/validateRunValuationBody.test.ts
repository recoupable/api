import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { validateRunValuationBody } from "@/lib/valuation/validateRunValuationBody";

describe("validateRunValuationBody", () => {
  it("accepts a body with a spotify_artist_id", () => {
    const result = validateRunValuationBody({ spotify_artist_id: "0xPoV" });
    expect(result).toEqual({ spotify_artist_id: "0xPoV" });
  });

  it("400s with an error envelope when spotify_artist_id is missing", async () => {
    const result = validateRunValuationBody({});
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.missing_fields).toEqual(["spotify_artist_id"]);
  });

  it("400s when spotify_artist_id is empty or not a string", () => {
    expect(validateRunValuationBody({ spotify_artist_id: "" })).toBeInstanceOf(NextResponse);
    expect(validateRunValuationBody({ spotify_artist_id: 5 })).toBeInstanceOf(NextResponse);
    expect(validateRunValuationBody(null)).toBeInstanceOf(NextResponse);
  });
});
