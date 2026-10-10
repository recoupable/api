import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  ContextResearchSourceScope,
  NormalizedContextResearchSource,
} from "./artistResearchTypes";
import { canonicalizeContextSourceUrl } from "./canonicalizeContextSourceUrl";
import { parseContextSourceDate } from "./parseContextSourceDate";

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

/** Lower-cased words separated by single spaces, padded so whole-name matches need no regex over untrusted text. */
function tokenize(text: string) {
  return ` ${text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
}

function classify(text: string, focal: string, excluded: string[]): ContextResearchSourceScope {
  let remaining = tokenize(text);
  let collaborator = false;
  for (const name of excluded) {
    if (!remaining.includes(name)) continue;
    collaborator = true;
    remaining = remaining.split(name).join(" ");
  }
  if (remaining.includes(focal)) return "focal_artist";
  return collaborator ? "collaborator_only" : "unattributed";
}

function dateFields(candidate: { date?: string; last_updated?: string }) {
  for (const dateSource of ["date", "last_updated"] as const) {
    const parsed = parseContextSourceDate(candidate[dateSource]);
    if (parsed.precision !== "unknown")
      return { publishedAt: parsed.value, datePrecision: parsed.precision, dateSource };
  }
  return { publishedAt: null, datePrecision: "unknown" as const, dateSource: null };
}

/** Deterministic, model-free source identity: canonical URLs, honest dates, one entry per underlying story. Snippets stay data. */
export function normalizeContextResearchSources(
  input: z.input<typeof inputSchema>,
): NormalizedContextResearchSources {
  const args = inputSchema.parse(input);
  const focal = tokenize(args.artistName);
  const excluded = args.excludeNames.map(tokenize).filter(name => name.trim() && name !== focal);
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
    const storyKey = createHash("sha256")
      .update(`${tokenize(candidate.title)}\n${tokenize(candidate.snippet)}`)
      .digest("hex");
    const story = stories.get(storyKey);
    if (story) {
      story.copies.push(canonical.url);
      copiesCollapsed += 1;
      continue;
    }
    stories.set(storyKey, {
      storyKey,
      url: canonical.url,
      copies: [canonical.url],
      title: candidate.title,
      snippet: candidate.snippet,
      ...dateFields(candidate),
      retrievedAt: args.retrievedAt,
      scope: classify(`${candidate.title} ${candidate.snippet}`, focal, excluded),
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
