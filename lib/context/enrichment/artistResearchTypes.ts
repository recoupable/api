import { z } from "zod";

export const contextDatePrecisionSchema = z.enum(["day", "month", "year", "unknown"]);
export type ContextDatePrecision = z.infer<typeof contextDatePrecisionSchema>;

export const contextResearchClaimKindSchema = z.enum([
  "quote",
  "reported_fact",
  "interpretation",
  "unclassified",
]);
export type ContextResearchClaimKind = z.infer<typeof contextResearchClaimKindSchema>;

export const contextResearchSourceScopeSchema = z.enum([
  "focal_artist",
  "collaborator_only",
  "unattributed",
]);
export type ContextResearchSourceScope = z.infer<typeof contextResearchSourceScopeSchema>;

/** One underlying story after canonicalization; `copies` lists every URL carrying identical text. */
const httpsUrl = z.url({ protocol: /^https$/ });

export const normalizedContextResearchSourceSchema = z.object({
  storyKey: z.string().regex(/^[0-9a-f]{64}$/),
  url: httpsUrl,
  copies: z.array(httpsUrl).min(1).max(100),
  title: z.string(),
  snippet: z.string(),
  publishedAt: z.string().nullable(),
  datePrecision: contextDatePrecisionSchema,
  dateSource: z.enum(["date", "last_updated"]).nullable(),
  retrievedAt: z.iso.datetime(),
  scope: contextResearchSourceScopeSchema,
});
export type NormalizedContextResearchSource = z.infer<typeof normalizedContextResearchSourceSchema>;

/**
 * A synthesized claim exactly as the artist-research-v1 recipe accepts it (no extra length limits, so any
 * persisted prior parses); `kind` stays optional until the recipe supplies it.
 */
export const contextResearchClaimSchema = z.object({
  claim: z.string(),
  sourceUrl: z.string(),
  date: z.string().nullable(),
  kind: contextResearchClaimKindSchema.optional(),
});
export type ContextResearchClaim = z.infer<typeof contextResearchClaimSchema>;
