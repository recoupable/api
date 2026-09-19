import { z } from "zod";
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
    .min(2)
    .max(3),
  selectedIndex: z.number().int().min(0).max(2),
  concept: z.string(),
  journey: z.array(z.string()).min(3).max(8),
  evidence: z.array(z.string()).max(12),
  assets: z
    .array(
      z.object({
        name: z.string().max(100),
        purpose: z.string(),
        prompt: z.string().max(4000),
        aspectRatio: z.enum(["16:9", "1:1", "9:16"]),
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
export type CreativeReview = z.infer<typeof reviewSchema>;
export type ReleaseContext = {
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
    status: "analyzed" | "unavailable";
    coverage: "provided-audio" | "preview" | "none";
    analysis: string;
    reason?: string;
  };
  research: {
    status: "available" | "unavailable";
    sources: { title: string; url: string; snippet: string }[];
    reason?: string;
  };
};
