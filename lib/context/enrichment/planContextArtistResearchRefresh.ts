import { z } from "zod";
import {
  contextResearchClaimSchema,
  normalizedContextResearchSourceSchema,
  type NormalizedContextResearchSource,
} from "./artistResearchTypes";
import { canonicalizeContextSourceUrl } from "./canonicalizeContextSourceUrl";

const DAY_MS = 86_400_000;
const count = z.number().int().min(0);
const normalizedSchema = z.object({
  retrievedAt: z.iso.datetime(),
  sources: z.array(normalizedContextResearchSourceSchema).max(20),
  rejected: z.array(z.object({ url: z.string(), reason: z.enum(["invalid_url", "non_https"]) })),
  counts: z.object({
    candidates: count,
    rejected: count,
    underlyingSources: count,
    copiesCollapsed: count,
    truncated: count,
  }),
});
const policySchema = z.object({
  maxAgeDays: z.number().int().min(1).max(3650).default(90),
  maxSources: z.number().int().min(1).max(20).default(20),
  maxSearchCalls: z.number().int().min(0).max(1).default(1),
  maxModelCalls: z.number().int().min(0).max(1).default(1),
});
const inputSchema = z.strictObject({
  artistSubjectId: z.string().trim().min(1).max(200),
  now: z.iso.datetime(),
  prior: z
    .object({
      resultId: z.string().min(1).max(200),
      version: z.number().int().min(1),
      retrievedAt: z.iso.datetime(),
      claims: z.array(contextResearchClaimSchema).max(500),
      sourceUrls: z.array(z.string().min(1).max(2048)).max(100),
      withdrawn: z.boolean(),
    })
    .nullable(),
  search: z.discriminatedUnion("status", [
    z.object({ status: z.literal("ok"), calls: count.max(10), normalized: normalizedSchema }),
    z.object({ status: z.literal("failed"), calls: count.max(10), error: z.string().max(2000) }),
  ]),
  policy: policySchema.optional(),
});

export type ContextArtistResearchRefreshReason =
  | "no_prior_research"
  | "prior_fresh"
  | "prior_stale"
  | "prior_withdrawn"
  | "new_underlying_sources"
  | "no_new_sources"
  | "no_usable_sources"
  | "collaborator_only_evidence"
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
  budget: {
    searchCalls: number;
    modelCalls: 0 | 1;
    sourcesConsidered: number;
    underlyingSources: number;
    copiesCollapsed: number;
    collaboratorOnlySources: number;
  };
}

/** Decide reuse, one bounded collect, or no paid work at all. Pure: no search, model, database or retry. */
export function planContextArtistResearchRefresh(
  input: z.input<typeof inputSchema>,
): ContextArtistResearchRefreshPlan {
  const args = inputSchema.parse(input);
  const policy = args.policy ?? policySchema.parse({});
  const status: "fresh" | "stale" | "withdrawn" | null = !args.prior
    ? null
    : args.prior.withdrawn
      ? "withdrawn"
      : (Date.parse(args.now) - Date.parse(args.prior.retrievedAt)) / DAY_MS > policy.maxAgeDays
        ? "stale"
        : "fresh";
  const reasons: ContextArtistResearchRefreshReason[] = [
    status === null ? "no_prior_research" : `prior_${status}`,
  ];
  const reusable = status === "fresh";
  const base = {
    artistSubjectId: args.artistSubjectId,
    prior:
      args.prior && status
        ? { resultId: args.prior.resultId, version: args.prior.version, status }
        : null,
    sourcesToSynthesize: [],
  };
  const budget: ContextArtistResearchRefreshPlan["budget"] = {
    searchCalls: args.search.calls,
    modelCalls: 0,
    sourcesConsidered: 0,
    underlyingSources: 0,
    copiesCollapsed: 0,
    collaboratorOnlySources: 0,
  };
  const settle = (extra: ContextArtistResearchRefreshReason[]): ContextArtistResearchRefreshPlan =>
    reusable && args.prior
      ? {
          ...base,
          decision: "reuse",
          reasons: [...reasons, ...extra],
          reusedResultId: args.prior.resultId,
          budget,
        }
      : {
          ...base,
          decision: "blocked",
          reasons: [...reasons, ...extra],
          reusedResultId: null,
          budget,
        };
  if (args.search.calls > policy.maxSearchCalls) return settle(["search_budget_exceeded"]);
  if (args.search.status === "failed") return settle(["search_failed"]);
  const { normalized } = args.search;
  const priorUrls = new Set(
    (args.prior?.sourceUrls ?? []).map(url => {
      const canonical = canonicalizeContextSourceUrl(url);
      return canonical.ok ? canonical.url : url;
    }),
  );
  const usable = normalized.sources.filter(source => source.scope !== "collaborator_only");
  budget.sourcesConsidered = normalized.counts.candidates;
  budget.underlyingSources = normalized.sources.length;
  budget.copiesCollapsed = normalized.counts.copiesCollapsed;
  budget.collaboratorOnlySources = normalized.sources.length - usable.length;
  if (!usable.length)
    return settle(
      budget.collaboratorOnlySources
        ? ["collaborator_only_evidence", "no_usable_sources"]
        : ["no_usable_sources"],
    );
  const cited = usable.filter(source => source.copies.some(url => priorUrls.has(url)));
  const fresh = usable.filter(source => !cited.includes(source));
  if (fresh.length) reasons.push("new_underlying_sources");
  if (reusable && !fresh.length) return settle(["no_new_sources"]);
  if (policy.maxModelCalls < 1) return settle(["model_call_not_authorized"]);
  const sourcesToSynthesize = [...fresh, ...cited].slice(0, policy.maxSources);
  if (sourcesToSynthesize.length < fresh.length + cited.length)
    reasons.push("source_limit_applied");
  return {
    ...base,
    decision: "collect",
    reasons,
    reusedResultId: null,
    sourcesToSynthesize,
    budget: { ...budget, modelCalls: 1 },
  };
}
