import { z } from "zod";
import { collectContextCatalogValuation } from "../providers/collectContextCatalogValuation";
import { runContextEnrichment } from "./runContextEnrichment";
type Dependencies = Omit<Parameters<typeof runContextEnrichment>[4], "call"> & {
  collect?: typeof collectContextCatalogValuation;
};
/** Resolve from an authorized context request; never accept an independently supplied catalog ID. */
export async function collectContextCatalogEstimate(
  actor: string,
  owner: string,
  requestId: string,
  input: { subjectId: string; collectionVersion: string },
  deps: Dependencies,
) {
  const args = z
    .strictObject({ subjectId: z.uuid(), collectionVersion: z.string().min(1).max(100) })
    .parse(input);
  const resolve = async () => {
    await deps.authorize(actor, owner);
    return z.object({ catalogId: z.uuid() }).parse(
      await deps.rpc("resolve_context_catalog", {
        p_owner: owner,
        p_request: requestId,
        p_subject: args.subjectId,
      }),
    ).catalogId;
  };
  const catalogId = await resolve(),
    url = `urn:recoup:catalog:${catalogId}`;
  return runContextEnrichment(
    actor,
    owner,
    requestId,
    {
      key: "catalog-valuation-v1",
      topic: "catalog_valuation",
      subjectId: args.subjectId,
      provider: "recoup",
      model: "computeValuationBand",
      evidenceKind: "estimate",
      input: { catalogId, collectionVersion: args.collectionVersion },
      sources: [
        {
          url,
          kind: "provider_metadata",
          content: { catalogId, collectionVersion: args.collectionVersion, role: "lookup_request" },
        },
      ],
    },
    {
      ...deps,
      authorize: async () => {
        if ((await resolve()) !== catalogId) throw new Error("Catalog identity changed");
      },
      call: async () => {
        const result = await (deps.collect ?? collectContextCatalogValuation)(actor, catalogId);
        if (result.catalogId !== catalogId)
          throw new Error("Valuation returned a different catalog");
        return {
          content: result,
          coverage: result.status === "not_measured" ? "unknown" : "partial",
          trace: result.trace,
          costUsd: null,
          costStatus: "unknown",
          observedSources: [
            {
              url,
              kind: "provider_metadata",
              content: {
                inputs: result.inputs,
                measurementCoverage: result.measurementCoverage,
                ageSource: result.ageSource,
                observedAt: result.trace.startedAt,
              },
            },
          ],
        };
      },
    },
  );
}
