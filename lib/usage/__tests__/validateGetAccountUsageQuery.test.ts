import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetAccountUsageQuery } from "@/lib/usage/validateGetAccountUsageQuery";
import { validateAccountCreditsParams } from "@/lib/credits/validateAccountCreditsParams";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/credits/validateAccountCreditsParams", () => ({
  validateAccountCreditsParams: vi.fn(),
}));

const ACCOUNT_ID = "123e4567-e89b-12d3-a456-426614174000";
const req = (qs = "") =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT_ID}/usage${qs}`, {
    headers: { "x-api-key": "k" },
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAccountCreditsParams).mockResolvedValue(ACCOUNT_ID);
});
afterEach(() => vi.useRealTimers());

describe("validateGetAccountUsageQuery", () => {
  it("gates on the account first and carries the resolved account id", async () => {
    const result = await validateGetAccountUsageQuery(req(), ACCOUNT_ID);
    expect(validateAccountCreditsParams).toHaveBeenCalledWith(expect.any(NextRequest), ACCOUNT_ID);
    expect(result).toMatchObject({ accountId: ACCOUNT_ID, limit: 20, cursor: undefined });
  });

  it("returns the auth short-circuit as { error } with its status, without parsing the query", async () => {
    vi.mocked(validateAccountCreditsParams).mockResolvedValue(
      NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    );
    const result = await validateGetAccountUsageQuery(req("?limit=0"), ACCOUNT_ID);
    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("defaults to the current UTC month up to now, 20 items", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T12:00:00.000Z"));
    const result = await validateGetAccountUsageQuery(req(), ACCOUNT_ID);
    expect(result).toEqual({
      accountId: ACCOUNT_ID,
      limit: 20,
      cursor: undefined,
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-27T12:00:00.000Z",
    });
  });

  it("accepts explicit bounds, a cursor and a limit, normalised to UTC ISO", async () => {
    const result = await validateGetAccountUsageQuery(
      req(
        "?limit=5&from=2026-08-10T00:00:00%2B02:00&to=2026-08-20T00:00:00Z&cursor=2026-08-15T10:00:00Z",
      ),
      ACCOUNT_ID,
    );
    expect(result).toEqual({
      accountId: ACCOUNT_ID,
      limit: 5,
      cursor: "2026-08-15T10:00:00.000Z",
      from: "2026-08-09T22:00:00.000Z",
      to: "2026-08-20T00:00:00.000Z",
    });
  });

  it("rejects from >= to with 400", async () => {
    const result = await validateGetAccountUsageQuery(
      req("?from=2026-08-20T00:00:00Z&to=2026-08-10T00:00:00Z"),
      ACCOUNT_ID,
    );
    expect((result as NextResponse).status).toBe(400);
    await expect((result as NextResponse).json()).resolves.toEqual({
      error: "from must be earlier than to",
    });
  });

  it("rejects a bad limit or cursor with 400 naming the field", async () => {
    const bad = (await validateGetAccountUsageQuery(req("?limit=101"), ACCOUNT_ID)) as NextResponse;
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toEqual({ error: expect.stringMatching(/^limit: /) });
    const cursor = (await validateGetAccountUsageQuery(
      req("?cursor=yesterday"),
      ACCOUNT_ID,
    )) as NextResponse;
    expect(cursor.status).toBe(400);
    await expect(cursor.json()).resolves.toEqual({ error: expect.stringMatching(/^cursor: /) });
  });
});
