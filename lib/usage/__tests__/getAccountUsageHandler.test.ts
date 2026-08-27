import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAccountUsageHandler } from "@/lib/usage/getAccountUsageHandler";
import { validateGetAccountUsageQuery } from "@/lib/usage/validateGetAccountUsageQuery";
import { selectUsagePage } from "@/lib/usage/selectUsagePage";
import { selectAllUsageEvents } from "@/lib/admins/credits/selectAllUsageEvents";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/usage/validateGetAccountUsageQuery", () => ({
  validateGetAccountUsageQuery: vi.fn(),
}));
vi.mock("@/lib/usage/selectUsagePage", () => ({
  selectUsagePage: vi.fn(),
}));
vi.mock("@/lib/admins/credits/selectAllUsageEvents", () => ({
  selectAllUsageEvents: vi.fn(),
}));

const ACCOUNT_ID = "123e4567-e89b-12d3-a456-426614174000";
const params = Promise.resolve({ id: ACCOUNT_ID });
const req = (qs = "") =>
  new NextRequest(`http://localhost/api/accounts/${ACCOUNT_ID}/usage${qs}`, {
    headers: { "x-api-key": "k" },
  });
const row = (id: string, created_at: string, cents: number) => ({
  id,
  account_id: ACCOUNT_ID,
  source: "api",
  agent_type: "main",
  provider: "fal",
  model_id: "minimax/music-3",
  input_tokens: 0,
  cached_input_tokens: 0,
  output_tokens: 0,
  tool_call_count: 0,
  created_at,
  credits_deducted: cents,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(validateGetAccountUsageQuery).mockResolvedValue({
    accountId: ACCOUNT_ID,
    limit: 2,
    sort: "created_at",
    cursor: undefined,
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-08-27T00:00:00.000Z",
  });
  vi.mocked(selectAllUsageEvents).mockResolvedValue([
    row("c", "2026-08-25T10:00:00+00:00", 40000),
    row("b", "2026-08-20T10:00:00+00:00", 20000),
    row("a", "2026-08-10T10:00:00+00:00", 10000),
  ] as never);
});

describe("getAccountUsageHandler", () => {
  it("returns the period, the aggregate total and the page with a cursor when full", async () => {
    vi.mocked(selectUsagePage).mockResolvedValue([
      row("b", "2026-08-20T10:00:00+00:00", 20000),
      row("a", "2026-08-10T10:00:00+00:00", 10000),
    ] as never);
    const res = await getAccountUsageHandler(
      req("?limit=2&from=2026-08-01T00:00:00Z&to=2026-08-27T00:00:00Z"),
      params,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.account_id).toBe(ACCOUNT_ID);
    expect(body.period).toEqual({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-27T00:00:00.000Z",
    });
    expect(body.total_credits_deducted).toBe(70000);
    expect(body.total_usd).toBe("$0.07");
    expect(body.events.map((e: { id: string }) => e.id)).toEqual(["b", "a"]);
    expect(body.events[0].credits_deducted).toBe(20000);
    expect(body.events[0].usd).toBe("$0.02");
    expect(body.next_cursor).toBe("2026-08-10T10:00:00.000Z");
    expect(selectAllUsageEvents).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      createdAfter: "2026-08-01T00:00:00.000Z",
      createdBefore: "2026-08-27T00:00:00.000Z",
    });
    expect(selectUsagePage).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-27T00:00:00.000Z",
      sort: "created_at",
      cursor: undefined,
      limit: 2,
    });
  });

  it("pages with the cursor as the upper bound when it is inside the period", async () => {
    vi.mocked(selectUsagePage).mockResolvedValue([] as never);
    vi.mocked(validateGetAccountUsageQuery).mockResolvedValue({
      accountId: ACCOUNT_ID,
      limit: 5,
      sort: "created_at",
      cursor: { createdAt: "2026-08-20T10:00:00.000Z" },
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-27T00:00:00.000Z",
    });
    await getAccountUsageHandler(req(), params);
    expect(selectUsagePage).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { createdAt: "2026-08-20T10:00:00.000Z" }, limit: 5 }),
    );
    expect(selectAllUsageEvents).toHaveBeenCalledWith(
      expect.objectContaining({ createdBefore: "2026-08-27T00:00:00.000Z" }),
    );
  });

  it("returns next_cursor null on a short page and total 0 for an empty period", async () => {
    vi.mocked(selectUsagePage).mockResolvedValue([] as never);
    vi.mocked(selectAllUsageEvents).mockResolvedValue([] as never);
    const body = await (await getAccountUsageHandler(req(), params)).json();
    expect(body.events).toEqual([]);
    expect(body.next_cursor).toBeNull();
    expect(body.total_credits_deducted).toBe(0);
    expect(body.total_usd).toBe("$0.00");
  });

  it("returns the validator's response untouched without touching the database", async () => {
    const short = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    vi.mocked(validateGetAccountUsageQuery).mockResolvedValue(short);
    const res = await getAccountUsageHandler(req(), params);
    expect(res).toBe(short);
    expect(selectUsagePage).not.toHaveBeenCalled();
    expect(selectAllUsageEvents).not.toHaveBeenCalled();
  });

  it("masks database failures as a 500 { error }", async () => {
    vi.mocked(selectUsagePage).mockRejectedValue(new Error("db down"));
    const res = await getAccountUsageHandler(req(), params);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("encodes next_cursor as credits_deducted:id when sorting by cost", async () => {
    vi.mocked(validateGetAccountUsageQuery).mockResolvedValue({
      accountId: ACCOUNT_ID,
      limit: 2,
      sort: "cost",
      cursor: undefined,
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-27T00:00:00.000Z",
    });
    vi.mocked(selectUsagePage).mockResolvedValue([
      row("big", "2026-08-10T10:00:00+00:00", 40000),
      row("mid", "2026-08-20T10:00:00+00:00", 20000),
    ] as never);
    const body = await (await getAccountUsageHandler(req("?sort=cost"), params)).json();
    expect(body.events.map((e: { id: string }) => e.id)).toEqual(["big", "mid"]);
    expect(body.next_cursor).toBe("20000:mid");
  });
});
