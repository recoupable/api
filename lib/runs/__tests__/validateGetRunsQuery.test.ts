import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { validateGetRunsQuery } from "../validateGetRunsQuery";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const params = (q: Record<string, string>) => new URLSearchParams(q);

describe("validateGetRunsQuery", () => {
  it("accepts kind=valuation and defaults limit to 1", () => {
    const result = validateGetRunsQuery(params({ kind: "valuation" }));
    expect(result).toEqual({ kind: "valuation", limit: 1 });
  });

  it("accepts an explicit limit within range", () => {
    const result = validateGetRunsQuery(params({ kind: "valuation", limit: "5" }));
    expect(result).toEqual({ kind: "valuation", limit: 5 });
  });

  it("rejects a missing kind with 400", async () => {
    const result = validateGetRunsQuery(params({}));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  // Future kinds are new enum values, not new endpoints — until then, honest 400.
  it("rejects an unknown kind with 400 and the error envelope", async () => {
    const result = validateGetRunsQuery(params({ kind: "backfill" }));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const body = await (result as NextResponse).json();
    expect(body.status).toBe("error");
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("rejects an out-of-range limit with 400", () => {
    const result = validateGetRunsQuery(params({ kind: "valuation", limit: "50" }));
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
