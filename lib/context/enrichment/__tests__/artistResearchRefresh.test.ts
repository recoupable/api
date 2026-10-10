import { expect, it } from "vitest";
import { normalizeContextResearchSources } from "../normalizeContextResearchSources";
import { planContextArtistResearchRefresh } from "../planContextArtistResearchRefresh";
import { mergeContextArtistResearchClaims } from "../mergeContextArtistResearchClaims";

const now = "2026-10-10T12:00:00.000Z";
const artistSubjectId = "artist:nova";
const stories = {
  bio: {
    url: "https://press.example/nova-biography",
    title: "Nova biography",
    snippet: "Nova formed in Leeds in 2018 and released a debut EP in 2019.",
    date: "2024-05-01",
  },
  interview: {
    url: "https://mag.example/nova-interview-2019",
    title: "Nova interview",
    snippet: "Nova said the EP was recorded in a bedroom studio.",
    date: "2019-06-12",
  },
  single: {
    url: "https://news.example/nova-second-single",
    title: "Nova shares second single",
    snippet: "Nova released a second single today.",
    date: "2026-10-01",
  },
  collision: {
    url: "https://other.example/nova-collision",
    title: "Nova Ninefold announce a tour",
    snippet: "The duo plays Manchester in May.",
  },
};
function normalize(candidates: Array<(typeof stories)[keyof typeof stories]>) {
  return normalizeContextResearchSources({
    artistName: "Nova",
    excludeNames: ["Nova Ninefold"],
    retrievedAt: now,
    candidates,
  });
}
function prior(
  overrides: Partial<
    NonNullable<Parameters<typeof planContextArtistResearchRefresh>[0]["prior"]>
  > = {},
) {
  return {
    resultId: "result-1",
    version: 1,
    retrievedAt: "2026-09-20T00:00:00.000Z",
    claims: [
      { claim: "Nova formed in Leeds in 2018.", sourceUrl: stories.bio.url, date: "2018" },
      {
        claim: "The EP was recorded in a bedroom studio.",
        sourceUrl: stories.interview.url,
        date: "2019-06-12",
      },
    ],
    sourceUrls: [stories.bio.url, stories.interview.url],
    withdrawn: false,
    ...overrides,
  };
}
function plan(
  input: Partial<Parameters<typeof planContextArtistResearchRefresh>[0]> & {
    candidates?: Array<(typeof stories)[keyof typeof stories]>;
  },
) {
  const { candidates = [], ...rest } = input;
  return planContextArtistResearchRefresh({
    artistSubjectId,
    now,
    prior: null,
    search: { status: "ok", calls: 1, normalized: normalize(candidates) },
    ...rest,
  });
}

it("collects when no accepted research exists", () => {
  const result = plan({ candidates: [stories.bio, stories.interview] });
  expect(result.decision).toBe("collect");
  expect(result.reasons).toEqual(["no_prior_research", "new_underlying_sources"]);
  expect(result.sourcesToSynthesize.map(source => source.url)).toEqual([
    stories.bio.url,
    stories.interview.url,
  ]);
  expect(result.budget).toEqual({
    searchCalls: 1,
    modelCalls: 1,
    sourcesConsidered: 2,
    underlyingSources: 2,
    copiesCollapsed: 0,
    collaboratorOnlySources: 0,
  });
});

it("reuses fresh research for a second song when the stories are identical", () => {
  const result = plan({ prior: prior(), candidates: [stories.bio, stories.interview] });
  expect(result.decision).toBe("reuse");
  expect(result.reusedResultId).toBe("result-1");
  expect(result.reasons).toEqual(["prior_fresh", "no_new_sources"]);
  expect(result.sourcesToSynthesize).toEqual([]);
  expect(result.budget.modelCalls).toBe(0);
});

it("collects only the new story plus already-cited sources, bounded by the source limit", () => {
  const result = plan({
    prior: prior(),
    candidates: [stories.bio, stories.interview, stories.single],
    policy: { maxSources: 2 },
  });
  expect(result.decision).toBe("collect");
  expect(result.reasons).toEqual(["prior_fresh", "new_underlying_sources", "source_limit_applied"]);
  expect(result.sourcesToSynthesize.map(source => source.url)).toEqual([
    stories.single.url,
    stories.bio.url,
  ]);
  expect(result.budget.modelCalls).toBe(1);
});

it("flags a historical prior as stale and retains its dated claims after merge", () => {
  const stale = prior({ retrievedAt: "2026-03-01T00:00:00.000Z" });
  const result = plan({ prior: stale, candidates: [stories.bio, stories.interview] });
  expect(result.decision).toBe("collect");
  expect(result.reasons).toEqual(["prior_stale"]);
  expect(result.prior).toEqual({ resultId: "result-1", version: 1, status: "stale" });
  const merged = mergeContextArtistResearchClaims({
    prior: { resultId: stale.resultId, version: stale.version, claims: stale.claims },
    next: {
      resultId: "result-2",
      version: 2,
      claims: [
        {
          claim: "Nova now records in a commercial studio.",
          sourceUrl: stories.bio.url,
          date: "2024-05",
          kind: "reported_fact",
        },
      ],
    },
    sources: normalize([stories.bio, stories.interview]).sources,
  });
  expect(
    merged.claims.map(claim => [claim.claim, claim.status, claim.date, claim.datePrecision]),
  ).toEqual([
    ["Nova formed in Leeds in 2018.", "retained_prior", "2018", "year"],
    ["The EP was recorded in a bedroom studio.", "retained_prior", "2019-06-12", "day"],
    ["Nova now records in a commercial studio.", "new", "2024-05", "month"],
  ]);
  expect(merged.claims[1].provenance).toEqual([
    {
      resultId: "result-1",
      version: 1,
      sourceUrl: stories.interview.url,
      storyKey: expect.stringMatching(/^[0-9a-f]{64}$/),
      date: "2019-06-12",
      datePrecision: "day",
      kind: "unclassified",
    },
  ]);
  expect(merged.claims[2].kind).toBe("reported_fact");
});

it("collects again when the prior research was withdrawn", () => {
  const result = plan({
    prior: prior({ withdrawn: true }),
    candidates: [stories.bio, stories.interview],
  });
  expect(result.decision).toBe("collect");
  expect(result.reasons).toEqual(["prior_withdrawn"]);
  expect(result.reusedResultId).toBeNull();
  expect(result.prior?.status).toBe("withdrawn");
});

it("blocks without a paid call when candidates are empty or collaborator-only", () => {
  const empty = plan({ candidates: [] });
  expect(empty.decision).toBe("blocked");
  expect(empty.reasons).toEqual(["no_prior_research", "no_usable_sources"]);
  expect(empty.budget.modelCalls).toBe(0);
  const collaborator = plan({ candidates: [stories.collision] });
  expect(collaborator.decision).toBe("blocked");
  expect(collaborator.reasons).toEqual([
    "no_prior_research",
    "collaborator_only_evidence",
    "no_usable_sources",
  ]);
  expect(collaborator.sourcesToSynthesize).toEqual([]);
  expect(collaborator.budget).toMatchObject({ modelCalls: 0, collaboratorOnlySources: 1 });
  const reusable = plan({ prior: prior(), candidates: [stories.collision] });
  expect(reusable.decision).toBe("reuse");
  expect(reusable.reasons).toEqual([
    "prior_fresh",
    "collaborator_only_evidence",
    "no_usable_sources",
  ]);
});

it("treats a failed bounded search as blocked, not as a retry", () => {
  const failed = plan({ search: { status: "failed", calls: 1, error: "timeout" } });
  expect(failed.decision).toBe("blocked");
  expect(failed.reasons).toEqual(["no_prior_research", "search_failed"]);
  expect(failed.budget).toMatchObject({ searchCalls: 1, modelCalls: 0 });
  const fallback = plan({
    prior: prior(),
    search: { status: "failed", calls: 1, error: "timeout" },
  });
  expect(fallback.decision).toBe("reuse");
  expect(fallback.reasons).toEqual(["prior_fresh", "search_failed"]);
  const exceeded = plan({ search: { status: "failed", calls: 2, error: "timeout" } });
  expect(exceeded.decision).toBe("blocked");
  expect(exceeded.reasons).toEqual(["no_prior_research", "search_budget_exceeded"]);
});

it("blocks a collect when model calls are not authorized", () => {
  const result = plan({ candidates: [stories.bio], policy: { maxModelCalls: 0 } });
  expect(result.decision).toBe("blocked");
  expect(result.reasons).toEqual([
    "no_prior_research",
    "new_underlying_sources",
    "model_call_not_authorized",
  ]);
  expect(result.budget.modelCalls).toBe(0);
});

it("counts press-release copies as one corroborating source and keeps differing claims", () => {
  const copyA = { ...stories.single, url: "https://outlet-a.example/nova-single" };
  const copyB = { ...stories.single, url: "https://outlet-b.example/nova-single" };
  const sources = normalize([copyA, copyB, stories.bio]).sources;
  expect(sources).toHaveLength(2);
  const merged = mergeContextArtistResearchClaims({
    prior: {
      resultId: "result-1",
      version: 1,
      claims: [{ claim: "Nova released a second single.", sourceUrl: copyA.url, date: null }],
    },
    next: {
      resultId: "result-2",
      version: 2,
      claims: [
        { claim: "Nova released a second single.", sourceUrl: copyB.url, date: "2026-10-01" },
        { claim: "Nova released a second single.", sourceUrl: stories.bio.url, date: null },
        { claim: "Nova released a third single.", sourceUrl: stories.bio.url, date: null },
      ],
    },
    sources,
  });
  expect(merged.claims).toHaveLength(2);
  expect(merged.claims[0]).toMatchObject({
    claim: "Nova released a second single.",
    status: "retained_prior",
    corroboration: 2,
  });
  expect(merged.claims[0].provenance).toHaveLength(3);
  expect(merged.claims[0].provenance[0].storyKey).toBe(merged.claims[0].provenance[1].storyKey);
  expect(merged.claims[1]).toMatchObject({
    claim: "Nova released a third single.",
    status: "new",
    corroboration: 1,
  });
  expect(merged.counts).toEqual({
    prior: 1,
    next: 3,
    merged: 2,
    retainedPrior: 1,
    new: 1,
    deduplicated: 2,
  });
});
