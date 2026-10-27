import { z } from "zod";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { compareSpotifyDailyStreams } from "../../../lib/catalog/compareSpotifyDailyStreams";

const recipeBytes = readFileSync(new URL("./recipe.json", import.meta.url));
const recipeHash = createHash("sha256").update(recipeBytes).digest("hex");
const helperSha256 = "91dcca66c8dec0851c1f6e110257a63b730e9b7ae33a60bceb0e9ffcf318dd81";
const uuid = z.string().uuid();
const date = z.iso.date();
const timestamp = z.iso.datetime({ offset: true }).refine(v => Number.isFinite(Date.parse(v)));
const text = z
  .string()
  .min(1)
  .refine(v => v.trim().length > 0);
const period = z.object({ start: date, end_exclusive: date }).strict();
const binding = z
  .object({
    ownerId: uuid,
    subjectId: uuid,
    requestId: uuid,
    catalogId: uuid,
    resultId: uuid,
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    topic: z.literal("catalog_retained_streams"),
    sourceVersionIds: z.tuple([uuid]),
  })
  .strict();
const evidence = z
  .object({
    schemaVersion: z.literal(1),
    workspaceId: uuid,
    catalogId: uuid,
    subjectId: uuid,
    isrc: text,
    provider: z.literal("luminate"),
    metric: z.literal("daily_streams"),
    platform: z.literal("all_dsps"),
    territory: z.literal("worldwide"),
    timezone: z.literal("UTC"),
    since: date,
    until: date,
    periods: z
      .object({
        previous: period,
        current: period,
        days: z.number().int().min(1).max(366),
        timezone: z.literal("UTC"),
      })
      .strict(),
    providerRecordingId: text,
    observations: z
      .array(
        z
          .object({
            catalog_id: uuid,
            isrc: text,
            date,
            run_id: uuid,
            provider_recording_id: text,
            streams: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
            source_hash: z.string().regex(/^[a-fA-F0-9]{64}$/),
            retrieved_at: timestamp,
          })
          .strict(),
      )
      .min(1)
      .max(732),
    absentDates: z.array(date).max(732),
    nullDates: z.array(date).max(732),
    retrievalRange: z.object({ earliest: timestamp, latest: timestamp }).strict(),
  })
  .strict();
const schema = z
  .object({
    operation: z.literal("read_field"),
    recipe: z.literal("catalog-retained-stream-fields/1"),
    field: z.enum(["previous_streams", "current_streams", "absolute_growth", "percentage_growth"]),
    selection: binding
      .extend({
        query: z
          .object({
            since: date,
            days: z.number().int().min(1).max(366),
            timezone: z.literal("UTC"),
          })
          .strict(),
      })
      .strict(),
    boundary: z.discriminatedUnion("state", [
      z
        .object({ state: z.literal("qualified"), envelope: binding.extend({ evidence }).strict() })
        .strict(),
      z.object({ state: z.literal("unavailable") }).strict(),
      z.object({ state: z.literal("error") }).strict(),
    ]),
    asOf: timestamp,
  })
  .strict();
const refuse = (reason: string) => ({ state: "refused" as const, reason });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Evaluate a synthetic qualified envelope; this offline function establishes no source authority. */
export function evaluateRetainedStreamField(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return refuse("invalid_contract");
  const q = parsed.data;
  if (q.boundary.state !== "qualified")
    return refuse(q.boundary.state === "error" ? "source_error" : "source_unavailable");
  const { evidence: e, ...actual } = q.boundary.envelope;
  const { query, ...selected } = q.selection;
  if (!same(selected, actual)) return refuse("binding_mismatch");
  if (
    e.workspaceId !== actual.ownerId ||
    e.catalogId !== actual.catalogId ||
    e.subjectId !== actual.subjectId
  )
    return refuse("binding_mismatch");
  if (
    Buffer.byteLength(JSON.stringify(e), "utf8") > 524288 ||
    Buffer.byteLength(JSON.stringify(q.boundary.envelope), "utf8") > 786432
  )
    return refuse("size_limit");
  const day = 86400000,
    split = Date.parse(query.since + "T00:00:00Z");
  const dates = Array.from({ length: query.days * 2 }, (_, i) =>
    new Date(split + (i - query.days) * day).toISOString().slice(0, 10),
  );
  const until = new Date(split + query.days * day).toISOString().slice(0, 10);
  if (
    e.since !== dates[0] ||
    e.until !== until ||
    !same(e.periods, {
      previous: { start: dates[0], end_exclusive: query.since },
      current: { start: query.since, end_exclusive: until },
      days: query.days,
      timezone: "UTC",
    })
  )
    return refuse("period_mismatch");
  const rows = e.observations;
  if (
    rows.some(
      (r, i) =>
        r.catalog_id !== e.catalogId ||
        r.isrc !== e.isrc ||
        r.provider_recording_id !== e.providerRecordingId ||
        !dates.includes(r.date) ||
        (i > 0 && rows[i - 1].date >= r.date),
    )
  )
    return refuse("invalid_lineage");
  const absent = dates.filter(d => !rows.some(r => r.date === d)),
    nulls = rows.filter(r => r.streams === null).map(r => r.date);
  if (!same(absent, e.absentDates) || !same(nulls, e.nullDates))
    return refuse("missingness_mismatch");
  const times = rows.map(r => Date.parse(r.retrieved_at));
  if (
    Date.parse(e.retrievalRange.earliest) !== Math.min(...times) ||
    Date.parse(e.retrievalRange.latest) !== Math.max(...times)
  )
    return refuse("retrieval_mismatch");
  if (
    createHash("sha256")
      .update(
        readFileSync(
          new URL("../../../lib/catalog/compareSpotifyDailyStreams.ts", import.meta.url),
        ),
      )
      .digest("hex") !== helperSha256
  )
    return refuse("helper_changed");
  const comparison = compareSpotifyDailyStreams(
    rows.flatMap(r => (r.streams === null ? [] : [{ date: r.date, streams: r.streams }])),
    { since: query.since, days: query.days },
    new Date(q.asOf),
  );
  if (comparison.state === "invalid_observation" || comparison.state === "unfinished_period")
    return refuse(comparison.state);
  const amount = comparison[q.field];
  return {
    state: "ready" as const,
    recipe: q.recipe,
    recipeHash,
    helperSha256,
    field: {
      name: q.field,
      amount,
      state: amount === null ? "unknown" : "known",
      unit: q.field === "percentage_growth" ? "percent" : "streams",
      currency: null,
    },
    binding: actual,
    query,
    asOf: q.asOf,
    periods: e.periods,
    coverage: {
      comparisonState: comparison.state,
      absentDates: absent,
      nullDates: nulls,
      missingDays: comparison.missing_days,
    },
    zeroBaseline: comparison.zero_baseline,
    provenance: {
      provider: e.provider,
      providerRecordingId: e.providerRecordingId,
      isrc: e.isrc,
      metric: e.metric,
      platform: e.platform,
      territory: e.territory,
      timezone: e.timezone,
      retrievalRange: e.retrievalRange,
      observations: rows,
    },
    ref: {
      workspaceId: actual.ownerId,
      authority: "context",
      kind: "recording",
      id: actual.subjectId,
      sourceVersionIds: actual.sourceVersionIds,
    },
  };
}
