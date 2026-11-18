import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { valuationHistoryStore } from "./fixtures/valuationHistoryStore";
import { persistCatalogValuation } from "../persistCatalogValuation";
import { getCatalogValuationsHandler } from "../getCatalogValuationsHandler";
const boundary = vi.hoisted(() => ({ from: vi.fn(), owners: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: boundary.from } }));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: async () => ({ accountId: "actor_fixture" }),
}));
vi.mock("../getCatalogOwnerIds", () => ({ getCatalogOwnerIds: boundary.owners }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalog", () => ({
  selectAccountCatalog: async ({ accountIds }: { accountIds: string[] }) =>
    accountIds.includes("org_fixture") ? { account: "org_fixture" } : null,
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
const catalogId = "740d5050-40ec-4892-a040-b78bb50fef2f";
const input = {
  catalogId,
  valuation: { low: 1, mid: 2, high: 3 },
  measuredSongCount: 12,
  totalStreams: 123,
};
const read = (query = "") =>
  getCatalogValuationsHandler(
    new NextRequest(`https://example.invalid/catalogs/${catalogId}/valuations${query}`),
    catalogId,
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  const store = valuationHistoryStore();
  boundary.from.mockImplementation(store.from);
  boundary.owners.mockResolvedValue(["actor_fixture", "org_fixture"]);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Real HTTP forbidden");
    }),
  );
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("saves two dated estimates and reads only the owned catalog latest-first", async () => {
  vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
  expect(await persistCatalogValuation(input)).toBe(true);
  vi.setSystemTime(new Date("2026-10-08T00:00:00Z"));
  expect(await persistCatalogValuation({ ...input, valuation: { low: 2, mid: 4, high: 6 } })).toBe(
    true,
  );
  await persistCatalogValuation({
    ...input,
    catalogId: "550e8400-e29b-41d4-a716-446655440000",
    valuation: { low: 100, mid: 200, high: 300 },
  });
  const response = await read();
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(
    result.valuations.map((row: { mid: number; measured_at: string }) => [
      row.mid,
      row.measured_at,
    ]),
  ).toEqual([
    [4, "2026-10-08T00:00:00.000Z"],
    [2, "2026-10-01T00:00:00.000Z"],
  ]);
  expect((await (await read("?limit=1")).json()).valuations).toHaveLength(1);
});
it("rechecks membership and stops before history reads after org access is removed", async () => {
  await persistCatalogValuation(input);
  boundary.from.mockClear();
  boundary.owners.mockResolvedValue(["actor_fixture"]);
  const response = await read();
  expect(response.status).toBe(404);
  expect(boundary.from).not.toHaveBeenCalled();
});
