import { it, expect, vi } from "vitest";
import { collectContextCatalogValuation } from "../collectContextCatalogValuation";
const account = "11111111-1111-4111-8111-111111111111",
  catalog = "22222222-2222-4222-8222-222222222222";
it("checks access before reading measurements", async () => {
  const aggregate = vi.fn();
  await expect(
    collectContextCatalogValuation(account, catalog, {
      authorize: async () => {
        throw Error("denied");
      },
      aggregate,
      earliestDate: vi.fn(),
    }),
  ).rejects.toThrow("denied");
  expect(aggregate).not.toHaveBeenCalled();
});
it("keeps missing measurements unknown", async () => {
  const r = await collectContextCatalogValuation(account, catalog, {
    authorize: async () => {},
    aggregate: async () => ({ measuredSongCount: 0, totalStreams: 0 }),
    earliestDate: async () => null,
  });
  expect(r.status).toBe("not_measured");
  expect(r.valuation).toBeNull();
});
it("does not disguise provider failure as an unmeasured catalog", async () => {
  await expect(
    collectContextCatalogValuation(account, catalog, {
      authorize: async () => {},
      aggregate: async () => null,
      earliestDate: async () => null,
    }),
  ).rejects.toThrow("unavailable");
});
it("reuses the valuation model and retains its inputs", async () => {
  const r = await collectContextCatalogValuation(account, catalog, {
    authorize: async () => {},
    aggregate: async () => ({ measuredSongCount: 2, totalStreams: 100000 }),
    earliestDate: async () => null,
  });
  expect(r.valuation?.mid).toBeGreaterThan(0);
  expect(r.inputs.totalStreams).toBe(100000);
  expect(r.scope).toBe("workspace_private");
});
