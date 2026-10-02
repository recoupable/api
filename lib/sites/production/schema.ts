import { openingSequenceSchema } from "./openingSequence";
import { assetProductionSchema } from "../assets/catalog";
import { z } from "zod";
import { experienceContractSchema } from "./experienceContract";
export const directionSchema = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string(),
        format: z.string(),
        rationale: z.string(),
        fanPayoff: z.string(),
      }),
    )
    .min(1)
    .max(3),
  selectedIndex: z.number().int().min(0).max(2),
  contract: experienceContractSchema,
  opening: openingSequenceSchema.optional(),
  concept: z.string(),
  journey: z.array(z.string()).min(3).max(8),
  evidence: z.array(z.string()).max(12),
  assets: z
    .array(
      z.object({
        name: z.string().max(100),
        production: assetProductionSchema
          .optional()
          .describe(
            "Required for new asset plans: choose the model and explain why it fits this asset.",
          ),
        purpose: z.string(),
        prompt: z.string().max(4000),
        aspectRatio: z.enum(["16:9", "1:1", "9:16"]),
        style: z
          .enum(["illustration", "photographic"])
          .optional()
          .describe(
            "Use illustration for drawn, graphic or crafted worlds; photographic for editorial photography. Match the selected visual references.",
          ),
      }),
    )
    .max(2),
  acceptance: z.array(z.string()).min(3).max(10),
});
export const reviewSchema = z.object({
  verdict: z.enum(["pass", "revise"]),
  issues: z
    .array(
      z.object({
        severity: z.enum(["blocking", "visual", "minor"]),
        module: z.enum(["direction", "assets", "implementation"]),
        detail: z.string(),
        fix: z.string(),
      }),
    )
    .max(12),
  summary: z.string(),
});
export type CreativeDirection = z.infer<typeof directionSchema>;
export type CreativeReview = z.infer<typeof reviewSchema> & {
  blocked?: "credits";
  verification?: {
    scope: "generated-experience";
    nativeShareDelivery: "not-tested";
    spotifyAuthentication: "not-tested";
    opening?: Awaited<ReturnType<typeof import("./reviewOpeningSequence").reviewOpeningSequence>>;
    journey?: z.infer<typeof experienceContractSchema>;
    viewports: { name: string; journeyPassed?: boolean; errors: string[]; overflow: boolean }[];
  };
};
export type ReleaseContext = {
  gaps?: { trackUrl: string; topic: string; reason: string }[];
  tracks?: ReleaseContext[];
  siteSkill?: Awaited<ReturnType<typeof import("../skills/prepareSiteSkill").prepareSiteSkill>>;
  engine?: {
    briefId: string;
    requestIds: string[];
    documents: {
      id: string;
      resultId: string;
      subjectId: string;
      topic: string;
      version: number;
      evidenceKind: string;
      text: string;
      coverage: string;
      sourceVersionIds: string[];
    }[];
    missingTopics: string[];
    guidance: string;
  };
  release: {
    url: string;
    title: string;
    artists: string[];
    artwork: string | null;
    date: string | null;
    isrc: string | null;
    previewUrl: string | null;
  };
  music: {
    status: "analyzed" | "saved-analysis" | "unavailable";
    coverage: "provided-audio" | "preview" | "source-defined" | "none";
    analysis: string;
    reason?: string;
  };
  research: {
    status: "available" | "unavailable";
    sources: { title: string; url: string; snippet: string }[];
    reason?: string;
  };
};
