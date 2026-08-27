import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetAccountUsageQuery } from "@/lib/usage/validateGetAccountUsageQuery";

const ACCOUNT_ID = "123e4567-e89b-12d3-a456-426614174000";
const req = (qs = "") =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT_ID}/usage${qs}`, {
    headers: { "x-api-key": "k" },
  });

afterEach(() => vi.useRealTimers());

describe("validateGetAccountUsageQuery", () => {
  it("defaults to the current UTC month up to now, 20 items", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));
    const result = validateGetAccountUsageQuery(req());
    expect(result).toEqual({
      limit: 20,
      cursor: undefined,
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-27T12:00:00.000Z",
    });
  });

  it("accepts explicit bounds, a cursor and a limit", () => {
    const result = validateGetAccountUsageQuery(
      req(
        "?limit=5&cursor=2026-08-10T00:00:00.000Z&from=2026-08-01T00:00:00Z&to=2026-08-20T00:00:00Z",
      ),
    );
    expect(result).toEqual({
      limit: 5,
      cursor: "2026-08-10T00:00:00.000Z",
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-20T00:00:00.000Z",
    });
  });

  it.each(["?limit=0", "?limit=101", "?limit=abc", "?from=yesterday", "?cursor=1"])(
    "rejects %s with 400",
    async qs => {
      const result = validateGetAccountUsageQuery(req(qs));
      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
      const body = await (result as NextResponse).json();
      expect(typeof body.error).toBe("string");
    },
  );

  it("rejects from >= to with 400", async () => {
    const result = validateGetAccountUsageQuery(
      req("?from=2026-08-20T00:00:00Z&to=2026-08-01T00:00:00Z"),
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    await expect((result as NextResponse).json()).resolves.toEqual({
      error: "from must be earlier than to",
    });
  });
});
