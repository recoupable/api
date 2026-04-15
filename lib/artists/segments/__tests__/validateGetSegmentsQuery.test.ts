import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";

import { validateGetSegmentsQuery } from "../validateGetSegmentsQuery";

describe("validateGetSegmentsQuery", () => {
  it("returns defaults when no params are provided", () => {
    const result = validateGetSegmentsQuery(new URLSearchParams());

    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it("parses page and limit when provided", () => {
    const result = validateGetSegmentsQuery(new URLSearchParams({ page: "3", limit: "50" }));

    expect(result).toEqual({ page: 3, limit: 50 });
  });

  it("ignores stray artist_account_id query params", () => {
    const result = validateGetSegmentsQuery(
      new URLSearchParams({ artist_account_id: "should-be-ignored", page: "2" }),
    );

    expect(result).toEqual({ page: 2, limit: 20 });
  });

  it("returns a 400 response when page is not positive", () => {
    const result = validateGetSegmentsQuery(new URLSearchParams({ page: "0" }));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns a 400 response when limit exceeds the max", () => {
    const result = validateGetSegmentsQuery(new URLSearchParams({ limit: "500" }));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns a 400 response when page is not an integer", () => {
    const result = validateGetSegmentsQuery(new URLSearchParams({ page: "not-a-number" }));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
