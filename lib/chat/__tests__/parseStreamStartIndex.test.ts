import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { parseStreamStartIndex } from "@/lib/chat/parseStreamStartIndex";

const url = (qs: string) => new URL(`https://api.test/api/chat/abc/stream${qs}`);

describe("parseStreamStartIndex", () => {
  it("returns undefined when startIndex is absent — a fresh reader gets the whole turn", () => {
    expect(parseStreamStartIndex(url(""))).toBeUndefined();
  });

  it("parses a valid non-negative integer", () => {
    expect(parseStreamStartIndex(url("?startIndex=0"))).toBe(0);
    expect(parseStreamStartIndex(url("?startIndex=42"))).toBe(42);
  });

  it("returns a 400 response when startIndex is not a number", () => {
    const result = parseStreamStartIndex(url("?startIndex=abc"));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  // The documented schema is `integer, minimum 0`. A negative value is
  // meaningful to the underlying SDK (it counts back from the end of a live
  // stream) but resolves differently on every call, so the contract excludes it.
  it("returns a 400 response when startIndex is negative", () => {
    const result = parseStreamStartIndex(url("?startIndex=-5"));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns a 400 response when startIndex is fractional", () => {
    const result = parseStreamStartIndex(url("?startIndex=1.5"));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns a 400 response when startIndex is present but empty", () => {
    const result = parseStreamStartIndex(url("?startIndex="));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
