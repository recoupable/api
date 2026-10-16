import { createHash } from "node:crypto";
import { z } from "zod";
import type { NormalizedContextResearchSource } from "./artistResearchTypes";
import { canonicalizeContextSourceUrl } from "./canonicalizeContextSourceUrl";
import { classifyContextResearchSourceScope } from "./classifyContextResearchSourceScope";
import { parseContextSourceDate } from "./parseContextSourceDate";
import { tokenizeContextResearchText } from "./tokenizeContextResearchText";

const MAX_UNDERLYING_SOURCES = 20;
const inputSchema = z.strictObject({
  artistName: z.string().trim().min(1).max(200),
  excludeNames: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  retrievedAt: z.iso.datetime(),
  candidates: z
    .array(
      z.object({
        url: z.string().min(1).max(2048),
        title: z.string().max(2000),
        snippet: z.string().max(20000),
        date: z.string().max(100).optional(),
        last_updated: z.string().max(100).optional(),
      }),
    )
    .max(100),
});

export interface NormalizedContextResearchSources {
  retrievedAt: string;
  sources: NormalizedContextResearchSource[];
  rejected: Array<{ url: string; reason: "invalid_url" | "non_https" }>;
  counts: {
    candidates: number;
    rejected: number;
    underlyingSources: number;
    copiesCollapsed: number;
    truncated: number;
  };
}

type DateFields = Pick<
  NormalizedContextResearchSource,
  "publishedAt" | "datePrecision" | "dateSource"
>;

function dateFields(
  candidate: { date?: string; last_updated?: string },
  notAfter: string,
): DateFields {
  for (const dateSource of ["date", "last_updated"] as const) {
    const parsed = parseContextSourceDate(candidate[dateSource], notAfter);
    if (parsed.precision !== "unknown")
      return { publishedAt: parsed.value, datePrecision: parsed.precision, dateSource };
  }
  return { publishedAt: null, datePrecision: "unknown", dateSource: null };
}

/** True when `next` is a known date earlier than `current`, or the same date at a finer precision. */
function isEarlier(next: DateFields, current: DateFields) {
  if (next.publishedAt === null) return false;
  if (current.publishedAt === null) return true;
  const length = Math.min(next.publishedAt.length, current.publishedAt.length);
  const [a, b] = [next.publishedAt.slice(0, length), current.publishedAt.slice(0, length)];
  return a < b || (a === b && next.publishedAt.length > current.publishedAt.length);
}

/**
 * Deterministic, model-free source identity: canonical URLs, honest dates (the earliest known date across copies),
 * one entry per underlying story. Snippets stay data.
 */
export function normalizeContextResearchSources(
  input: z.input<typeof inputSchema>,
): NormalizedContextResearchSources {
  const args = inputSchema.parse(input);
  const focal = tokenizeContextResearchText(args.artistName);
  const excluded = args.excludeNames
    .map(tokenizeContextResearchText)
    .filter(name => name.length && name.join(" ") !== focal.join(" "));
  const rejected: NormalizedContextResearchSources["rejected"] = [];
  const seenUrls = new Set<string>();
  const stories = new Map<string, NormalizedContextResearchSource>();
  let copiesCollapsed = 0;
  for (const candidate of args.candidates) {
    const canonical = canonicalizeContextSourceUrl(candidate.url);
    if (canonical.ok === false) {
      rejected.push({ url: candidate.url, reason: canonical.reason });
      continue;
    }
    if (seenUrls.has(canonical.url)) {
      copiesCollapsed += 1;
      continue;
    }
    seenUrls.add(canonical.url);
    const title = tokenizeContextResearchText(candidate.title);
    const snippet = tokenizeContextResearchText(candidate.snippet);
    // Text-less candidates keep their own identity instead of all sharing the empty-text story.
    const identity =
      title.length || snippet.length
        ? `${title.join(" ")}\n${snippet.join(" ")}`
        : `url\n${canonical.url}`;
    const storyKey = createHash("sha256").update(identity).digest("hex");
    const dates = dateFields(candidate, args.retrievedAt);
    const story = stories.get(storyKey);
    if (story) {
      story.copies.push(canonical.url);
      if (isEarlier(dates, story)) Object.assign(story, dates);
      copiesCollapsed += 1;
      continue;
    }
    stories.set(storyKey, {
      storyKey,
      url: canonical.url,
      copies: [canonical.url],
      title: candidate.title,
      snippet: candidate.snippet,
      ...dates,
      retrievedAt: args.retrievedAt,
      // The empty token separates title from snippet so no name can match across the boundary.
      scope: classifyContextResearchSourceScope([...title, "", ...snippet], focal, excluded),
    });
  }
  const all = [...stories.values()];
  const sources = all.slice(0, MAX_UNDERLYING_SOURCES);
  return {
    retrievedAt: args.retrievedAt,
    sources,
    rejected,
    counts: {
      candidates: args.candidates.length,
      rejected: rejected.length,
      underlyingSources: sources.length,
      copiesCollapsed,
      truncated: all.length - sources.length,
    },
  };
}
