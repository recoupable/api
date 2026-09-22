import { z } from "zod";
export const recordingSchema = z.object({
  title: z.string().min(1).max(300),
  artists: z.array(z.string().min(1).max(200)).min(1).max(20),
  durationSeconds: z.number().positive().max(7200),
});
export const youtubeCandidateSchema = z.object({
  id: z.string().regex(/^[\w-]{11}$/),
  title: z.string(),
  channel: z.string().nullish(),
  duration: z.number().nullish(),
});
export type Recording = z.infer<typeof recordingSchema>;
export type YoutubeCandidate = z.infer<typeof youtubeCandidateSchema>;
export type AudioCommand = (command: string, args: string[]) => Promise<string>;
