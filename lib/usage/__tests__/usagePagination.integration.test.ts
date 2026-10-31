import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Tables } from "@/types/database.types";
import supabase from "@/lib/supabase/serverClient";
import { validateAccountCreditsParams } from "@/lib/credits/validateAccountCreditsParams";
import { selectAllUsageEvents } from "@/lib/admins/credits/selectAllUsageEvents";
import { getAccountUsageHandler } from "@/lib/usage/getAccountUsageHandler";
import { encodeUsageCursor } from "@/lib/usage/encodeUsageCursor";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn() } }));
vi.mock("@/lib/credits/validateAccountCreditsParams", () => ({
  validateAccountCreditsParams: vi.fn(),
}));
vi.mock("@/lib/admins/credits/selectAllUsageEvents", () => ({ selectAllUsageEvents: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
let records: Tables<"usage_events">[];
const micros = (timestamp: string) =>
  BigInt(Date.parse(timestamp)) * 1000n +
  BigInt((timestamp.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0").slice(3, 6));
const row = (id: string, timestamp: string, amount = 1): Tables<"usage_events"> => ({
  id,
  account_id: ACCOUNT,
  created_at: timestamp,
  credits_deducted: amount,
  source: null,
  agent_type: null,
  provider: null,
  model_id: null,
  input_tokens: null,
  cached_input_tokens: null,
  output_tokens: null,
  tool_call_count: null,
  resource_url: null,
});

// Exercise the real handler, cursor codec, page selector and Supabase query builder.
// Only authentication, independent totals, and database transport use local fixtures.
function fixtureQuery() {
  const filters: ((item: Tables<"usage_events">) => boolean)[] = [];
  const order: string[] = [];
  let range = [0, 99];
  const value = (item: Tables<"usage_events">, column: string) =>
    column === "created_at" ? micros(item.created_at) : item[column as keyof typeof item];
  const query = {
    select: () => query,
    order: (column: string) => {
      order.push(column);
      return query;
    },
    range: (from: number, to: number) => {
      range = [from, to];
      return query;
    },
    eq: (column: string, expected: string) => {
      filters.push(item => value(item, column) === expected);
      return query;
    },
    gte: (_column: string, timestamp: string) => {
      filters.push(item => micros(item.created_at) >= micros(timestamp));
      return query;
    },
    lt: (_column: string, timestamp: string) => {
      filters.push(item => micros(item.created_at) < micros(timestamp));
      return query;
    },
    or: (expression: string) => {
      const time = /^created_at\.lt\.(.+),and\(created_at\.eq\.(.+),id\.lt\.([\w-]+)\)$/.exec(
        expression,
      );
      const cost =
        /^credits_deducted\.lt\.(\d+),and\(credits_deducted\.eq\.(\d+),id\.lt\.([\w-]+)\)$/.exec(
          expression,
        );
      if (time)
        filters.push(
          item =>
            micros(item.created_at) < micros(time[1]) ||
            (micros(item.created_at) === micros(time[2]) && item.id < time[3]),
        );
      else if (cost)
        filters.push(
          item =>
            item.credits_deducted < Number(cost[1]) ||
            (item.credits_deducted === Number(cost[2]) && item.id < cost[3]),
        );
      else throw new Error(`Unexpected fixture query: ${expression}`);
      return query;
    },
    then: (resolve: (result: { data: Tables<"usage_events">[]; error: null }) => unknown) => {
      const data = records
        .filter(item => filters.every(filter => filter(item)))
        .sort((a, b) => {
          for (const column of order) {
            const left = value(a, column)!;
            const right = value(b, column)!;
            if (left !== right) return left > right ? -1 : 1;
          }
          return 0;
        })
        .slice(range[0], range[1] + 1);
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  records = [];
  vi.mocked(validateAccountCreditsParams).mockResolvedValue(ACCOUNT);
  vi.mocked(supabase.from).mockImplementation(() => fixtureQuery() as never);
  vi.mocked(selectAllUsageEvents).mockImplementation(async params =>
    records.filter(
      item =>
        item.account_id === params.accountId &&
        micros(item.created_at) >= micros(params.createdAfter!) &&
        micros(item.created_at) < micros(params.createdBefore!),
    ),
  );
});

async function traverse(sort: "created_at" | "cost", from: string, to: string, limit = 1) {
  const ids: string[] = [];
  let total = 0;
  let cursor: string | null = null;
  for (let page = 0; page <= records.length; page++) {
    const query = new URLSearchParams({ sort, from, to, limit: String(limit) });
    if (cursor) query.set("cursor", cursor);
    const response = await getAccountUsageHandler(
      new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/usage?${query}`),
      Promise.resolve({ id: ACCOUNT }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    ids.push(...body.events.map((event: { id: string }) => event.id));
    total += body.events.reduce(
      (sum: number, event: { credits_deducted: number }) => sum + event.credits_deducted,
      0,
    );
    cursor = body.next_cursor;
    if (!cursor) {
      expect(total).toBe(body.total_credits_deducted);
      expect(new Set(ids).size).toBe(ids.length);
      return ids;
    }
  }
  throw new Error("Pagination did not terminate");
}

describe("usage paging through local database fixtures", () => {
  it.each(["legacy", "composite"])(
    "keeps period bounds for %s cursors outside the period",
    async format => {
      records = [
        row("inside", "2026-08-20T10:00:00.123456Z"),
        row("outside", "2026-09-01T00:00:00.000000Z"),
      ];
      for (const [timestamp, expected] of [
        ["2026-09-02T00:00:00.000000Z", ["inside"]],
        ["2026-07-31T00:00:00.000000Z", []],
      ] as const) {
        const cursor =
          format === "legacy"
            ? timestamp
            : encodeUsageCursor("created_at", row("cursor", timestamp));
        const query = new URLSearchParams({
          from: "2026-08-01T00:00:00Z",
          to: "2026-09-01T00:00:00Z",
          cursor,
        });
        const response = await getAccountUsageHandler(
          new NextRequest(`http://localhost/api/accounts/${ACCOUNT}/usage?${query}`),
          Promise.resolve({ id: ACCOUNT }),
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.events.map((event: { id: string }) => event.id)).toEqual(expected);
        expect(body.total_credits_deducted).toBe(1);
      }
    },
  );

  it("traverses identical timestamps with limit=1 exactly once", async () => {
    records = [
      row("tie-a", "2026-08-20T10:00:00.123456Z"),
      row("tie-b", "2026-08-20T10:00:00.123456Z"),
    ];
    expect(await traverse("created_at", "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z")).toEqual([
      "tie-b",
      "tie-a",
    ]);
  });

  it("crosses timestamp groups while preserving period and account boundaries", async () => {
    records = [
      row("lower", "2026-08-01T00:00:00.000000Z", 2),
      row("tie-a", "2026-08-20T10:00:00.123456Z", 3),
      row("tie-b", "2026-08-20T10:00:00.123456Z", 5),
      row("newer", "2026-08-25T00:00:00.000001Z", 7),
      row("upper", "2026-09-01T00:00:00.000000Z", 11),
      row("before", "2026-07-31T23:59:59.999999Z", 13),
      { ...row("other-account", "2026-08-20T10:00:00.123456Z", 17), account_id: "other" },
    ];
    expect(await traverse("created_at", "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z", 2)).toEqual(
      ["newer", "tie-b", "tie-a", "lower"],
    );
  });

  it("preserves distinct microsecond timestamps and narrow bounds", async () => {
    records = [
      row("early", "2026-08-20T10:00:00.000001Z"),
      row("later", "2026-08-20T10:00:00.000002Z"),
      row("upper", "2026-08-20T10:00:00.000003Z"),
    ];
    expect(
      await traverse("created_at", "2026-08-20T10:00:00.000001Z", "2026-08-20T10:00:00.000003Z"),
    ).toEqual(["later", "early"]);
  });

  it("keeps cost/id ties stable independently of timestamp order", async () => {
    records = [
      row("z-older", "2026-08-10T00:00:00.000000Z", 5),
      row("a-newer", "2026-08-20T00:00:00.000000Z", 5),
      row("cheap", "2026-08-25T00:00:00.000000Z", 2),
    ];
    expect(await traverse("cost", "2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z")).toEqual([
      "z-older",
      "a-newer",
      "cheap",
    ]);
  });
});
