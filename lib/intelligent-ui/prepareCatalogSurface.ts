import { createHash } from "node:crypto";
import { z } from "zod";
import { getCatalogStreams } from "@/lib/catalog/getCatalogStreams";
import { catalogStreamHistoryQuerySchema } from "@/lib/catalog/validateCatalogStreamHistoryQuery";

import { getCatalogDistributionText } from "./getCatalogDistributionText";

const inputSchema = z
  .object({
    accountId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    query: catalogStreamHistoryQuerySchema,
    assistantMessageId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
  })
  .strict();

/** Internal saved-read adapter. Actor must come from route authentication, never model input. */
export async function prepareCatalogSurface(input: z.input<typeof inputSchema>) {
  const { accountId, workspaceId, query, assistantMessageId } = inputSchema.parse(input);
  const result = await getCatalogStreams(accountId, query, { workspaceId, includeLineage: true });
  if (result.error || !result.data) throw new Error(result.error ?? "Catalog streams unavailable");
  const data = result.data;
  const lineage = data.recordings
    .flatMap(recording => recording.source_observations ?? [])
    .map(row => {
      if (!row.run_id || !/^[a-f0-9]{64}$/i.test(row.source_hash ?? "") || !row.retrieved_at)
        throw new Error("Observation lineage unavailable");
      return {
        catalog_id: row.catalog_id,
        isrc: row.isrc,
        date: row.date,
        provider_recording_id: row.provider_recording_id,
        streams: row.streams,
        run_id: row.run_id,
        source_hash: row.source_hash,
        retrieved_at: row.retrieved_at,
      };
    })
    .sort((a, b) => a.isrc.localeCompare(b.isrc) || a.date.localeCompare(b.date));
  // Fixed key order + sorted source rows, not model JSON or newest-run-only provenance.
  const canonical = JSON.stringify({
    mappingVersion: "catalog-streams-v1",
    workspaceId,
    query,
    periods: data.periods,
    pagination: data.pagination,
    membership: data.recordings
      .map(r => ({ isrc: r.isrc, name: r.name, provider_recording_id: r.provider_recording_id }))
      .sort((a, b) => a.isrc.localeCompare(b.isrc)),
    lineage,
  });
  const fingerprint = createHash("sha256").update(canonical).digest("hex");
  const id = `catalog-${createHash("sha256").update(assistantMessageId).digest("hex").slice(0, 32)}`;
  const included = data.recordings.filter(
    r => r.state === "comparable" && r.current_streams !== null,
  );
  const total = included.reduce((sum, r) => sum + r.current_streams!, 0);
  const safeDistribution =
    included.length > 0 &&
    Number.isSafeInteger(total) &&
    total > 0 &&
    included.every(r => r.current_streams! <= 1e12) &&
    data.pagination.total_count <= 1_000_000;
  const inclusiveEnd = new Date(Date.parse(data.periods.current.end_exclusive) - 86400000)
    .toISOString()
    .slice(0, 10);
  const population = `Comparable recordings on catalog page ${query.page}; ${data.recordings.length} loaded of ${data.pagination.total_count} current members`;
  const sourceText = [
    "Luminate source-reported daily streams across reporting DSPs, worldwide; not Spotify-only, listeners or royalties.",
    `Current UTC period [${data.periods.current.start}, ${data.periods.current.end_exclusive}); equal previous period [${data.periods.previous.start}, ${data.periods.previous.end_exclusive}).`,
    `${population}. More pages: ${data.pagination.has_more ? "yes" : "no"}. Provider update time unknown. Calendar completeness does not prove freshness.`,
    "Historical saved observations at this response revision; a new read rechecks access and selects retained corrections. Paused collection is not withdrawal.",
    `Input fingerprint (catalog-streams-v1): ${fingerprint}.`,
    ...data.recordings
      .filter(r => !safeDistribution || r.current_streams === null)
      .map(
        r =>
          `${r.isrc}: ${r.current_streams === null ? `unavailable (${r.state}; missing dates: ${String(r.missing_days.length)})` : `${r.current_streams} streams`}.`,
      ),
    ...(!safeDistribution
      ? ["Distribution unavailable: no safe positive total; missing values are not zero."]
      : []),
  ].join("\n");
  const evidenceId = "saved-stream-observations";
  const components = safeDistribution
    ? [
        {
          type: "distribution" as const,
          id: "catalog-current-streams",
          title: "Saved streams by recording",
          measure: {
            label: "Luminate streams across reporting DSPs",
            unit: "streams",
            periodStart: data.periods.current.start,
            periodEnd: inclusiveEnd,
            population,
          },
          items: included.map(r => ({
            id: r.isrc,
            label: (r.name?.trim() || r.isrc).slice(0, 160),
            value: r.current_streams!,
            evidenceIds: [evidenceId],
          })),
          complete:
            !data.pagination.has_more &&
            query.page === 1 &&
            included.length === data.pagination.total_count,
          totalCount: data.pagination.total_count,
        },
      ]
    : [];
  const retrievals = lineage.map(row => new Date(row.retrieved_at).toISOString()).sort();
  const observationTime = retrievals.at(-1);
  const evidence = observationTime
    ? [
        {
          id: evidenceId,
          label: "Saved observation retrievals",
          sourceLabel: "Luminate / retained catalog observations",
          observedAt: observationTime,
          kind: "observed" as const,
          status: "partial" as const,
          text: `${sourceText}\nRetained retrieval range: ${retrievals[0]} to ${observationTime}; not provider update times.`,
        },
      ]
    : [];
  const sourceLabel = evidence[0]
    ? `${evidence[0].label} · ${evidence[0].sourceLabel} · ${evidence[0].observedAt} · ${evidence[0].status}`
    : "";
  const fallbackText = [sourceText, ...components.map(getCatalogDistributionText), sourceLabel]
    .filter(Boolean)
    .join("\n\n");
  const surface = {
    schemaVersion: 1 as const,
    id,
    revision: 1,
    title: "Catalog listening",
    description: "Saved Luminate streams for the selected catalog page.",
    context: {
      workspaceId,
      subject: { kind: "catalog", id: query.catalog_id, label: "Selected catalog" },
    },
    components,
    evidence,
    fallbackText,
    answer: {
      revision: 1,
      parts: [
        { type: "markdown" as const, id: "source-context", text: sourceText },
        ...components.map(component => ({
          type: "representation" as const,
          id: "listening-distribution",
          componentId: component.id,
          benefit: "show-distribution" as const,
        })),
        ...(evidence.length
          ? [{ type: "sources" as const, id: "source-retrievals", evidenceIds: [evidenceId] }]
          : []),
      ],
    },
  };
  return { surface, fingerprint, lineage, mappingVersion: "catalog-streams-v1" as const };
}
