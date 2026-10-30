import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as canonical from "../../../lib/catalog/compareSpotifyDailyStreams";
import { evaluateRetainedStreamField } from "./evaluate";

const vectors = JSON.parse(
  fs.readFileSync(
    new URL("../../../docs/contracts/catalog-stream-evidence-2207/vectors.json", import.meta.url),
    "utf8",
  ),
);
const fields = [
  "previous_streams",
  "current_streams",
  "absolute_growth",
  "percentage_growth",
] as const;
// These outcomes belong to the qualified source boundary, not to this calculator.
const unavailable = new Set([
  "correction_not_yet_context_bound",
  "all_dates_changed_provider",
  "workspace_revoked",
  "member_removed",
  "unresolved_recording",
  "source_withdrawn",
  "version_removed",
  "attempted_recreation_after_withdrawal",
  "unstable_chunked_read",
  "arbitrary_caller_tuple",
  "result_not_accepted",
]);
function inputFor(c: any, field: string = "current_streams") {
  const b = structuredClone({ ...vectors.base, ...c.replaceBaseFields });
  const observations = b.bundleRows.map((k: string) => structuredClone(vectors.retainedRows[k]));
  const day = 86400000,
    split = Date.parse(b.window.since);
  const date = (n: number) => new Date(n).toISOString().slice(0, 10);
  const since = date(split - b.window.days * day),
    until = date(split + b.window.days * day);
  const dates = Array.from({ length: b.window.days * 2 }, (_, i) =>
    date(Date.parse(since) + i * day),
  );
  const times = observations.map((r: any) => r.retrieved_at).sort();
  const binding = {
    ownerId: vectors.ids.workspace,
    subjectId: vectors.ids.recording,
    requestId: vectors.ids.request,
    catalogId: vectors.ids.catalog,
    resultId: vectors.ids.result1,
    revision: b.documentRevision,
    topic: "catalog_retained_streams",
    sourceVersionIds: [b.sourceVersion],
  };
  const evidence = {
    schemaVersion: 1,
    workspaceId: vectors.ids.workspace,
    catalogId: vectors.ids.catalog,
    subjectId: vectors.ids.recording,
    isrc: "USAAA2600001",
    provider: "luminate",
    metric: "daily_streams",
    platform: "all_dsps",
    territory: "worldwide",
    timezone: "UTC",
    since,
    until,
    periods: {
      previous: { start: since, end_exclusive: b.window.since },
      current: { start: b.window.since, end_exclusive: until },
      days: b.window.days,
      timezone: "UTC",
    },
    providerRecordingId: b.providerId,
    observations,
    absentDates: dates.filter(d => !observations.some((r: any) => r.date === d)),
    nullDates: observations.filter((r: any) => r.streams === null).map((r: any) => r.date),
    retrievalRange: {
      earliest: times[0] ?? "2026-10-21T12:00:00Z",
      latest: times.at(-1) ?? "2026-10-21T12:00:00Z",
    },
  };
  const envelope = {
    ...binding,
    revision: b.currentDocumentRevision,
    sourceVersionIds: [b.currentSourceVersion],
    evidence,
  };
  const input: any = {
    operation: "read_field",
    recipe: "catalog-retained-stream-fields/1",
    field,
    selection: { ...binding, query: b.window },
    boundary: { state: "qualified", envelope },
    asOf: "2026-10-27T12:00:00Z",
  };
  if (unavailable.has(c.id)) input.boundary = { state: "unavailable" };
  if (c.id === "storage_failure") input.boundary = { state: "error" };
  if (c.id === "cross_owner_version") input.boundary.envelope.ownerId = b.sourceOwner;
  if (c.id === "unsupported_field_relabel") input.field = b.requestedField;
  if (c.id === "forged_hash_only") input.selection.sourceVersionIds = ["a".repeat(64)];
  if (["late_writer_cas_lost", "customer_correction_blocks_refresh"].includes(c.id))
    input.operation = "accept_binding";
  return input;
}

describe("adopted31 design vectors, computational scope only", () => {
  for (const c of vectors.cases) {
    it(c.id, () => {
      const expectation = c.expectedUnderAdoptedProposal;
      if (expectation.state === "refused") {
        const out = evaluateRetainedStreamField(inputFor(c));
        expect(out.state).toBe("refused");
        return;
      }
      const spy = vi.spyOn(canonical, "compareSpotifyDailyStreams");
      for (const field of fields) {
        const input = inputFor(c, field),
          before = structuredClone(input);
        const out = evaluateRetainedStreamField(input);
        expect(out.state).toBe("ready");
        if (out.state !== "ready") throw new Error(out.reason);
        expect(out.field.amount).toBe(expectation.comparison[field]);
        expect(out.field.state).toBe(expectation.comparison[field] === null ? "unknown" : "known");
        expect(out.coverage.comparisonState).toBe(expectation.comparison.state);
        expect(out.zeroBaseline).toBe(expectation.comparison.zero_baseline);
        expect(out.ref).toEqual(expectation.ref);
        expect(input).toEqual(before);
      }
      expect(spy).toHaveBeenCalledTimes(4);
      spy.mockRestore();
    });
  }
});

it("pins the unchanged canonical helper", () => {
  const source = fs.readFileSync(
    new URL("../../../lib/catalog/compareSpotifyDailyStreams.ts", import.meta.url),
  );
  expect(createHash("sha256").update(source).digest("hex")).toBe(
    "91dcca66c8dec0851c1f6e110257a63b730e9b7ae33a60bceb0e9ffcf318dd81",
  );
});
it("rejects tampered periods, lineage, extra fields, missingness and stale bindings", () => {
  const mutations = [
    (q: any) => (q.field = "annual_spotify_royalties"),
    (q: any) => (q.sourceAuthorized = true),
    (q: any) => (q.boundary.envelope.evidence.periods.days = 2),
    (q: any) => (q.boundary.envelope.evidence.observations[0].source_hash = "opaque"),
    (q: any) => (q.boundary.envelope.evidence.absentDates = ["2026-10-19"]),
    (q: any) => (q.boundary.envelope.evidence.nullDates = ["2026-10-19"]),
    (q: any) => (q.boundary.envelope.evidence.retrievalRange.latest = "2026-10-27T12:00:00Z"),
    (q: any) => (q.selection.query.since = "2026-10-19"),
    (q: any) => (q.selection.resultId = vectors.ids.result2),
    (q: any) => (q.boundary.envelope.evidence.inventedGrowth = 999),
    (q: any) => (q.boundary.envelope.evidence.schemaVersion = "1"),
    (q: any) => q.boundary.envelope.sourceVersionIds.push(vectors.ids.version2),
    (q: any) =>
      q.boundary.envelope.evidence.observations.push(q.boundary.envelope.evidence.observations[0]),
    (q: any) => (q.boundary.envelope.evidence.observations[0].streams = NaN),
    (q: any) => (q.asOf = "2026-10-19T00:00:00Z"),
  ];
  for (const mutate of mutations) {
    const q = inputFor(vectors.cases[0]);
    mutate(q);
    expect(evaluateRetainedStreamField(q).state).toBe("refused");
  }
});
it("refuses unsafe complete-period sums using actual canonical helper", () => {
  const q = inputFor(vectors.cases[0]);
  const e = q.boundary.envelope.evidence;
  q.selection.query = { since: "2026-10-20", days: 2, timezone: "UTC" };
  e.since = "2026-10-18";
  e.until = "2026-10-22";
  e.periods = {
    previous: { start: e.since, end_exclusive: "2026-10-20" },
    current: { start: "2026-10-20", end_exclusive: e.until },
    days: 2,
    timezone: "UTC",
  };
  e.observations = Array.from({ length: 4 }, (_, i) => ({
    ...e.observations[0],
    date: `2026-10-${18 + i}`,
    streams: Number.MAX_SAFE_INTEGER,
  }));
  e.absentDates = [];
  e.nullDates = [];
  expect(evaluateRetainedStreamField(q)).toMatchObject({
    state: "refused",
    reason: "invalid_observation",
  });
});
it("distinguishes source unavailability from source errors without numeric output", () => {
  const q = inputFor(vectors.cases[0]);
  q.boundary = { state: "unavailable" };
  expect(evaluateRetainedStreamField(q)).toEqual({
    state: "refused",
    reason: "source_unavailable",
  });
  q.boundary = { state: "error" };
  expect(evaluateRetainedStreamField(q)).toEqual({ state: "refused", reason: "source_error" });
});

it("rejects provider and scope relabeling", () => {
  for (const [key, value] of [
    ["provider", "spotify"],
    ["metric", "annual_streams"],
    ["platform", "spotify"],
    ["territory", "US"],
  ]) {
    const q = inputFor(vectors.cases[0]);
    q.boundary.envelope.evidence[key] = value;
    expect(evaluateRetainedStreamField(q).state).toBe("refused");
  }
});
it("preserves unrounded percentages and exact provenance without aliasing input", () => {
  const q = inputFor(vectors.cases[0], "percentage_growth");
  q.boundary.envelope.evidence.observations[0].streams = 3;
  q.boundary.envelope.evidence.observations[1].streams = 4;
  const out = evaluateRetainedStreamField(q);
  expect(out.state).toBe("ready");
  if (out.state !== "ready") throw new Error(out.reason);
  expect(out.field).toEqual({
    name: "percentage_growth",
    amount: (1 / 3) * 100,
    state: "known",
    unit: "percent",
    currency: null,
  });
  expect(out.binding.resultId).toBe(q.selection.resultId);
  expect(out.recipeHash).toBe(
    createHash("sha256")
      .update(fs.readFileSync(new URL("./recipe.json", import.meta.url)))
      .digest("hex"),
  );
  out.provenance.observations[0].streams = 999;
  expect(q.boundary.envelope.evidence.observations[0].streams).toBe(3);
});
it("accepts 732 dates and refuses an oversized serialized envelope", () => {
  const q = inputFor(vectors.cases[0]);
  const e = q.boundary.envelope.evidence;
  const split = Date.parse("2025-10-20T00:00:00Z");
  const date = (v: number) => new Date(v).toISOString().slice(0, 10);
  q.selection.query = { since: date(split), days: 366, timezone: "UTC" };
  e.since = date(split - 366 * 86400000);
  e.until = date(split + 366 * 86400000);
  e.periods = {
    previous: { start: e.since, end_exclusive: date(split) },
    current: { start: date(split), end_exclusive: e.until },
    days: 366,
    timezone: "UTC",
  };
  e.observations = Array.from({ length: 732 }, (_, i) => ({
    ...e.observations[0],
    date: date(split + (i - 366) * 86400000),
    streams: 1,
  }));
  const result = evaluateRetainedStreamField(q);
  if (result.state === "refused") throw new Error(result.reason);
  expect(result).toMatchObject({ state: "ready", field: { amount: 366, unit: "streams" } });
  e.providerRecordingId = "é".repeat(1000);
  for (const row of e.observations) row.provider_recording_id = e.providerRecordingId;
  expect(evaluateRetainedStreamField(q)).toEqual({ state: "refused", reason: "size_limit" });
});
