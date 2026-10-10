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
export const normalizedContextResearchSourceSchema = z.object({
  storyKey: z.string().regex(/^[0-9a-f]{64}$/),
  url: z.url(),
  copies: z.array(z.url()).min(1).max(100),
  title: z.string(),
  snippet: z.string(),
  publishedAt: z.string().nullable(),
  datePrecision: contextDatePrecisionSchema,
  dateSource: z.enum(["date", "last_updated"]).nullable(),
  retrievedAt: z.iso.datetime(),
  scope: contextResearchSourceScopeSchema,
});
export type NormalizedContextResearchSource = z.infer<typeof normalizedContextResearchSourceSchema>;

/** A synthesized claim as the research recipe emits it; `kind` stays optional until the recipe supplies it. */
export const contextResearchClaimSchema = z.object({
  claim: z.string().min(1).max(2000),
  sourceUrl: z.string().min(1).max(2048),
  date: z.string().max(100).nullable(),
  kind: contextResearchClaimKindSchema.optional(),
});
export type ContextResearchClaim = z.infer<typeof contextResearchClaimSchema>;
