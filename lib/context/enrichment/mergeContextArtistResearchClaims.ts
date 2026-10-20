import { z } from "zod";
import {
  contextResearchClaimSchema,
  type ContextDatePrecision,
  type ContextResearchClaimKind,
} from "./artistResearchTypes";
import { canonicalizeContextSourceUrl } from "./canonicalizeContextSourceUrl";
import { parseContextSourceDate } from "./parseContextSourceDate";

const resultSchema = z.object({
  resultId: z.string().min(1).max(200),
  version: z.number().int().min(1),
  claims: z.array(contextResearchClaimSchema).max(500),
});
const inputSchema = z.strictObject({
  prior: resultSchema.nullable(),
  next: resultSchema.nullable(),
  sources: z
    .array(
      z.object({
        storyKey: z.string().min(1),
        url: z.string().min(1),
        copies: z.array(z.string().min(1)),
      }),
    )
    .max(100),
});

export interface ContextResearchClaimProvenance {
  resultId: string;
  version: number;
  sourceUrl: string;
  storyKey: string | null;
  date: string | null;
  datePrecision: ContextDatePrecision;
  kind: ContextResearchClaimKind;
}

export interface MergedContextResearchClaim {
  claim: string;
  kind: ContextResearchClaimKind;
  date: string | null;
  datePrecision: ContextDatePrecision;
  sourceUrl: string;
  storyKey: string | null;
  status: "retained_prior" | "new";
  corroboration: number;
  provenance: ContextResearchClaimProvenance[];
}

/** Case- and punctuation-folded text; claims with no letters or digits keep their exact text as the key. */
function claimKey(text: string) {
  const folded = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return folded ? `text:${folded}` : `raw:${text.trim()}`;
}

function sourceKey(provenance: ContextResearchClaimProvenance) {
  if (provenance.storyKey) return provenance.storyKey;
  const canonical = canonicalizeContextSourceUrl(provenance.sourceUrl);
  return `url:${canonical.ok ? canonical.url : provenance.sourceUrl}`;
}

/**
 * Merge prior and new research claims. Claim text is never rewritten; claims whose case- and punctuation-folded
 * text matches merge into one entry that shows the first wording and keeps every provenance. Copies of one
 * story (or one canonical URL) corroborate once. Contradictions are retained side by side, not resolved.
 */
export function mergeContextArtistResearchClaims(input: z.input<typeof inputSchema>): {
  claims: MergedContextResearchClaim[];
  counts: {
    prior: number;
    next: number;
    merged: number;
    retainedPrior: number;
    new: number;
    deduplicated: number;
  };
} {
  const args = inputSchema.parse(input);
  const storyByUrl = new Map<string, string>();
  for (const source of args.sources)
    for (const url of [source.url, ...source.copies]) storyByUrl.set(url, source.storyKey);
  const lookup = (url: string) => {
    const canonical = canonicalizeContextSourceUrl(url);
    return storyByUrl.get(url) ?? (canonical.ok ? storyByUrl.get(canonical.url) : null) ?? null;
  };
  const merged = new Map<string, MergedContextResearchClaim>();
  const ingest = (status: "retained_prior" | "new", result: z.infer<typeof resultSchema>) => {
    for (const claim of result.claims) {
      const parsed = parseContextSourceDate(claim.date);
      const provenance: ContextResearchClaimProvenance = {
        resultId: result.resultId,
        version: result.version,
        sourceUrl: claim.sourceUrl,
        storyKey: lookup(claim.sourceUrl),
        date: parsed.value,
        datePrecision: parsed.precision,
        kind: claim.kind ?? "unclassified",
      };
      const key = claimKey(claim.claim);
      const existing = merged.get(key);
      if (existing) {
        existing.provenance.push(provenance);
        continue;
      }
      merged.set(key, {
        claim: claim.claim,
        kind: provenance.kind,
        date: provenance.date,
        datePrecision: provenance.datePrecision,
        sourceUrl: provenance.sourceUrl,
        storyKey: provenance.storyKey,
        status,
        corroboration: 0,
        provenance: [provenance],
      });
    }
  };
  if (args.prior) ingest("retained_prior", args.prior);
  if (args.next) ingest("new", args.next);
  const claims = [...merged.values()].map(claim => ({
    ...claim,
    corroboration: new Set(claim.provenance.map(sourceKey)).size,
  }));
  const prior = args.prior?.claims.length ?? 0;
  const next = args.next?.claims.length ?? 0;
  return {
    claims,
    counts: {
      prior,
      next,
      merged: claims.length,
      retainedPrior: claims.filter(claim => claim.status === "retained_prior").length,
      new: claims.filter(claim => claim.status === "new").length,
      deduplicated: prior + next - claims.length,
    },
  };
}
