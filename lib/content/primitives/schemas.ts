import { z } from "zod";
import { CAPTION_LENGTHS } from "@/lib/content/captionLengths";

export const createImageBodySchema = z.object({
  artist_account_id: z.string().uuid(),
  template: z.string().min(1),
  prompt: z.string().optional(),
  face_guide_url: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
});

export const createVideoBodySchema = z.object({
  image_url: z.string().url(),
  template: z.string().optional(),
  lipsync: z.boolean().optional().default(false),
  song_url: z.string().url().optional(),
  audio_start_seconds: z.number().optional(),
  audio_duration_seconds: z.number().optional(),
  motion_prompt: z.string().optional(),
});

export const createTextBodySchema = z.object({
  artist_account_id: z.string().uuid(),
  song: z.string().min(1),
  template: z.string().optional(),
  length: z.enum(CAPTION_LENGTHS).optional().default("short"),
});

export const createAudioBodySchema = z.object({
  artist_account_id: z.string().uuid(),
  lipsync: z.boolean().optional().default(false),
  songs: z.array(z.string()).optional(),
});

export const createRenderBodySchema = z.object({
  video_url: z.string().url(),
  song_url: z.string().url(),
  audio_start_seconds: z.number(),
  audio_duration_seconds: z.number(),
  text: z.object({
    content: z.string().min(1),
    font: z.string().optional(),
    color: z.string().optional(),
    border_color: z.string().optional(),
    max_font_size: z.number().optional(),
  }),
  has_audio: z.boolean().optional().default(false),
});

export const createUpscaleBodySchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video"]),
});
