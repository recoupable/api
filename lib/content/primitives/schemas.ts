import { z } from "zod";
import { CAPTION_LENGTHS } from "@/lib/content/captionLengths";

export const createImageBodySchema = z.object({
  prompt: z.string().optional(),
  reference_image_url: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  model: z.string().optional(),
});

export const createVideoBodySchema = z.object({
  image_url: z.string().url(),
  lipsync: z.boolean().optional().default(false),
  audio_url: z.string().url().optional(),
  motion_prompt: z.string().optional(),
  model: z.string().optional(),
});

export const createTextBodySchema = z.object({
  topic: z.string().min(1),
  length: z.enum(CAPTION_LENGTHS).optional().default("short"),
});

export const createAudioBodySchema = z.object({
  audio_urls: z.array(z.string().url()).min(1),
  model: z.string().optional(),
});

export const editOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trim"),
    start: z.number().nonnegative(),
    duration: z.number().positive(),
  }),
  z.object({
    type: z.literal("crop"),
    aspect: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("resize"),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("overlay_text"),
    content: z.string().min(1),
    font: z.string().optional(),
    color: z.string().optional().default("white"),
    stroke_color: z.string().optional().default("black"),
    max_font_size: z.number().positive().optional().default(42),
    position: z.enum(["top", "center", "bottom"]).optional().default("bottom"),
  }),
  z.object({
    type: z.literal("mux_audio"),
    audio_url: z.string().url(),
    replace: z.boolean().optional().default(true),
  }),
]);

export const editBodySchema = z.object({
  video_url: z.string().url().optional(),
  audio_url: z.string().url().optional(),
  template: z.string().optional(),
  operations: z.array(editOperationSchema).optional(),
  output_format: z.enum(["mp4", "webm", "mov"]).optional().default("mp4"),
}).refine(
  data => data.video_url || data.audio_url,
  { message: "Must provide at least one input (video_url or audio_url)" },
).refine(
  data => data.template || (data.operations && data.operations.length > 0),
  { message: "Must provide either template or operations" },
);

export const createUpscaleBodySchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video"]),
});

export const createAnalyzeBodySchema = z.object({
  video_url: z.string().url(),
  prompt: z.string().min(1).max(2000),
  temperature: z.number().min(0).max(1).optional().default(0.2),
  stream: z.boolean().optional().default(false),
  max_tokens: z.number().int().min(1).max(4096).optional(),
});
