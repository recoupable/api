import { expect, it, vi } from "vitest";
import { collectContextCatalogEstimate } from "../collectContextCatalogEstimate";
import { collectContextCatalogValuation } from "../../providers/collectContextCatalogValuation";
const subject = "00000000-0000-4000-8000-000000000001",
  catalog = "00000000-0000-4000-8000-000000000002",
  actor = "00000000-0000-4000-8000-000000000003";
function deps() {
  return {
    authorize: vi.fn(async () => undefined),
    rpc: vi.fn(
      async (name: string): Promise<unknown> =>
        name === "resolve_context_catalog"
          ? { catalogId: catalog }
          : name === "claim_context_enrichment"
            ? { state: "claimed", attemptId: "a" }
            : { state: "saved" },
    ),
    collect: vi.fn(async () =>
      collectContextCatalogValuation(actor, catalog, {
        authorize: async () => {},
        aggregate: async () => ({ measuredSongCount: 1, totalStreams: 100 }),
        songCount: async () => 3,
        earliestDate: async () => null,
      }),
    ),
  };
}
it("saves an estimate with partial coverage and measurement snapshots", async () => {
  const d = deps();
  await collectContextCatalogEstimate(
    actor,
    actor,
    "request",
    { subjectId: subject, collectionVersion: "v1" },
    d,
  );
  expect(d.rpc).toHaveBeenCalledWith(
    "claim_context_enrichment",
    expect.objectContaining({
      p_module: expect.objectContaining({ evidenceKind: "estimate", topic: "catalog_valuation" }),
    }),
  );
  expect(d.rpc).toHaveBeenCalledWith(
    "complete_context_enrichment",
    expect.objectContaining({
      p_result: expect.objectContaining({
        coverage: "partial",
        observedSources: [
          expect.objectContaining({
            content: expect.objectContaining({
              measurementCoverage: expect.objectContaining({ unmeasuredSongCount: 2 }),
            }),
          }),
        ],
      }),
    }),
  );
});
it("rechecks catalog access even on reuse and skips valuation", async () => {
  const d = deps();
  d.rpc.mockImplementation(async name =>
    name === "resolve_context_catalog" ? { catalogId: catalog } : { state: "reused" },
  );
  await collectContextCatalogEstimate(
    actor,
    actor,
    "request",
    { subjectId: subject, collectionVersion: "v1" },
    d,
  );
  expect(d.collect).not.toHaveBeenCalled();
  expect(d.rpc.mock.calls.filter(c => c[0] === "resolve_context_catalog")).toHaveLength(2);
});
it("does not save when access is revoked during collection", async () => {
  const d = deps();
  let checks = 0;
  d.rpc.mockImplementation(async name => {
    if (name === "resolve_context_catalog") {
      if (++checks === 3) throw Error("revoked");
      return { catalogId: catalog };
    }
    return { state: "claimed", attemptId: "a" };
  });
  await expect(
    collectContextCatalogEstimate(
      actor,
      actor,
      "request",
      { subjectId: subject, collectionVersion: "v1" },
      d,
    ),
  ).rejects.toThrow("revoked");
  expect(d.rpc.mock.calls.map(c => c[0])).not.toContain("complete_context_enrichment");
});
it.each([true, false])(
  "saves labeled content under a new reuse key when measured=%s",
  async measured => {
    const d = deps();
    d.collect.mockImplementation(async () =>
      collectContextCatalogValuation(actor, catalog, {
        authorize: async () => {},
        aggregate: async () => ({
          measuredSongCount: measured ? 1 : 0,
          totalStreams: measured ? 100 : 0,
        }),
        songCount: async () => 3,
        earliestDate: async () => null,
      }),
    );
    await collectContextCatalogEstimate(
      actor,
      actor,
      "request",
      { subjectId: subject, collectionVersion: "v1" },
      d,
    );
    // A saved v1 valuation lacks provenance, so it must not be reused as-is.
    expect(d.rpc).toHaveBeenCalledWith(
      "claim_context_enrichment",
      expect.objectContaining({
        p_module: expect.objectContaining({ key: "catalog-valuation-v2" }),
      }),
    );
    const calls = d.rpc.mock.calls as unknown as [
      string,
      { p_result?: { content: unknown; coverage: string } },
    ][];
    const saved = calls.find(([name]) => name === "complete_context_enrichment")?.[1];
    // Exercise the JSON representation returned by read_context_documents.
    const content = JSON.parse(JSON.stringify(saved?.p_result?.content));
    expect(saved?.p_result?.coverage).toBe(measured ? "partial" : "unknown");
    expect(content.status).toBe(measured ? "estimated" : "not_measured");
    expect(content.estimate).toMatchObject({
      revenueBasis: "modeled_estimate",
      observedRevenue: { status: "not_collected" },
      scope: "workspace_private",
      shareable: false,
      methodology: { id: "recoup-master-catalog-band", version: 1 },
      period: {
        catalogAgeYears: content.catalogAgeYears,
        ageFlooredToOneYear: content.ageFlooredToOneYear,
        ageSource: content.ageSource,
        measuredThrough: null,
      },
      source: { freshness: "unknown" },
    });
    expect(content.estimate.period.catalogAgeYears).toBe(measured ? 5 : null);
    expect(content.estimate.period.ageSource).toBe(measured ? "model_default" : null);
    expect(content.estimate.currency).toBe(content.trace.currency);
    expect(content.estimate.scope).toBe(content.scope);
  },
);
