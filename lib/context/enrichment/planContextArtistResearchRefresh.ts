import type { z } from "zod";
import type { NormalizedContextResearchSource } from "./artistResearchTypes";
import { artistResearchRefreshInputSchema } from "./artistResearchRefreshInputSchema";
import { canonicalizeContextSourceUrl } from "./canonicalizeContextSourceUrl";

const DAY_MS = 86_400_000;

export type ContextArtistResearchRefreshReason =
  | "no_prior_research"
  | "prior_fresh"
  | "prior_stale"
  | "prior_withdrawn"
  | "new_underlying_sources"
  | "historical_sources_only"
  | "no_new_sources"
  | "no_usable_sources"
  | "collaborator_only_evidence"
  | "unattributed_evidence"
  | "sources_truncated"
  | "search_failed"
  | "search_budget_exceeded"
  | "model_call_not_authorized"
  | "source_limit_applied";

export interface ContextArtistResearchRefreshPlan {
  artistSubjectId: string;
  decision: "reuse" | "collect" | "blocked";
  reasons: ContextArtistResearchRefreshReason[];
  prior: { resultId: string; version: number; status: "fresh" | "stale" | "withdrawn" } | null;
  reusedResultId: string | null;
  sourcesToSynthesize: NormalizedContextResearchSource[];
  /** `searchCalls` is the bounded search already run before planning; `modelCalls` is what this plan would spend. */
  budget: {
    searchCalls: number;
    modelCalls: 0 | 1;
    sourcesConsidered: number;
    underlyingSources: number;
    copiesCollapsed: number;
    collaboratorOnlySources: number;
    unattributedSources: number;
  };
}

/** True when a known publication date falls strictly before `instant` at the source's own precision. */
function publishedBefore(source: NormalizedContextResearchSource, instant: string) {
  return (
    source.publishedAt !== null && source.publishedAt < instant.slice(0, source.publishedAt.length)
  );
}

/**
 * Decide reuse, one bounded collect, or no paid work at all. Pure: no search, model, database or retry.
 * Only focal-artist evidence can justify paid work; with fresh prior research, a newly found story that
 * was published before that research was retrieved does not justify it either.
 */
export function planContextArtistResearchRefresh(
  input: z.input<typeof artistResearchRefreshInputSchema>,
): ContextArtistResearchRefreshPlan {
  const { artistSubjectId, now, prior, search, policy } =
    artistResearchRefreshInputSchema.parse(input);
  const ageDays = prior ? (Date.parse(now) - Date.parse(prior.retrievedAt)) / DAY_MS : 0;
  const status: "fresh" | "stale" | "withdrawn" | null = !prior
    ? null
    : prior.withdrawn
      ? "withdrawn"
      : ageDays < -1 || ageDays > policy.maxAgeDays
        ? "stale"
        : "fresh";
  const reasons: ContextArtistResearchRefreshReason[] = [
    status === null ? "no_prior_research" : `prior_${status}`,
  ];
  const reusable = status === "fresh" && prior !== null;
  const base = {
    artistSubjectId,
    prior: prior && status ? { resultId: prior.resultId, version: prior.version, status } : null,
    sourcesToSynthesize: [],
  };
  const budget: ContextArtistResearchRefreshPlan["budget"] = {
    searchCalls: search.calls,
    modelCalls: 0,
    sourcesConsidered: 0,
    underlyingSources: 0,
    copiesCollapsed: 0,
    collaboratorOnlySources: 0,
    unattributedSources: 0,
  };
  const settle = (
    extra: ContextArtistResearchRefreshReason[],
  ): ContextArtistResearchRefreshPlan => ({
    ...base,
    decision: reusable ? "reuse" : "blocked",
    reasons: [...reasons, ...extra],
    reusedResultId: reusable && prior ? prior.resultId : null,
    budget,
  });
  if (search.calls > policy.maxSearchCalls) return settle(["search_budget_exceeded"]);
  if (search.status === "failed") return settle(["search_failed"]);
  const { sources, counts } = search.normalized;
  const scoped = (scope: NormalizedContextResearchSource["scope"]) =>
    sources.filter(source => source.scope === scope);
  const usable = scoped("focal_artist");
  budget.sourcesConsidered = counts.candidates;
  budget.underlyingSources = sources.length + counts.truncated;
  budget.copiesCollapsed = counts.copiesCollapsed;
  budget.collaboratorOnlySources = scoped("collaborator_only").length;
  budget.unattributedSources = scoped("unattributed").length;
  const truncated: ContextArtistResearchRefreshReason[] = counts.truncated
    ? ["sources_truncated"]
    : [];
  if (!usable.length)
    return settle([
      ...(budget.collaboratorOnlySources ? (["collaborator_only_evidence"] as const) : []),
      ...(budget.unattributedSources ? (["unattributed_evidence"] as const) : []),
      "no_usable_sources",
      ...truncated,
    ]);
  const priorUrls = new Set(
    (prior?.sourceUrls ?? []).map(url => {
      const canonical = canonicalizeContextSourceUrl(url);
      return canonical.ok ? canonical.url : url;
    }),
  );
  const cited = usable.filter(source => source.copies.some(url => priorUrls.has(url)));
  const uncited = usable.filter(source => !cited.includes(source));
  const current =
    reusable && prior
      ? uncited.filter(source => !publishedBefore(source, prior.retrievedAt))
      : uncited;
  reasons.push(
    current.length
      ? "new_underlying_sources"
      : uncited.length
        ? "historical_sources_only"
        : "no_new_sources",
    ...truncated,
  );
  if (reusable && !current.length) return settle([]);
  if (policy.maxModelCalls < 1) return settle(["model_call_not_authorized"]);
  const ordered = [...current, ...uncited.filter(source => !current.includes(source)), ...cited];
  const sourcesToSynthesize = ordered.slice(0, policy.maxSources);
  if (sourcesToSynthesize.length < ordered.length) reasons.push("source_limit_applied");
  return {
    ...base,
    decision: "collect",
    reasons,
    reusedResultId: null,
    sourcesToSynthesize,
    budget: { ...budget, modelCalls: 1 },
  };
}
