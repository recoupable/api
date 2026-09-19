import { z } from "zod";

/** Only capabilities actually available inside the isolated generated experience. */
export const experienceCapabilities = {
  "browser-interaction":
    "Working local game, instrument, story or interaction using HTML/CSS/JS. No server state or leaderboard.",
  "production-artwork":
    "Up to two images generated before publication through Recoup image generation. Real asset URLs are supplied to the builder. This is NOT visitor-time personalized AI generation.",
  "image-download":
    "Create a real PNG/JPEG/WebP with canvas or composition of supplied CORS-enabled assets. Export nonempty bytes and provide a download. Test by reopening the exported image. No fake generation delay.",
  "file-share":
    "Share an actual image File through navigator.share when supported, with a working image-download fallback. No persistent personalized result URL or hosted result storage is available. Native OS delivery requires a separate device check.",
} as const;
export const experienceContractSchema = z.object({
  releaseConnection: z.string().min(20),
  evidence: z.array(z.string().min(5)).min(1).max(8),
  motivation: z.string().min(20),
  payoff: z.string().min(20),
  capabilities: z
    .array(z.enum(["browser-interaction", "production-artwork", "image-download", "file-share"]))
    .min(1),
  steps: z
    .array(
      z.object({
        action: z.enum(["click", "fill", "press", "download", "share"]),
        target: z.string().min(1).max(100),
        value: z.string().max(200),
        expected: z.string().max(300),
        checkpoint: z.enum(["participate", "result", "delivery"]),
      }),
    )
    .min(3)
    .max(16),
});
export type ExperienceContract = z.infer<typeof experienceContractSchema>;
