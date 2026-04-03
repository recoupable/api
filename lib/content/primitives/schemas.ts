import { z } from "zod";
import { CAPTION_LENGTHS } from "@/lib/content/captionLengths";

export const createImageBodySchema = z.object({
  template: z.string().optional(),
  prompt: z.string().optional(),
  reference_image_url: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
  num_images: z.number().int().min(1).max(4).optional().default(1),
  aspect_ratio: z.enum([
    "auto", "21:9", "16:9", "3:2", "4:3", "5:4",
    "1:1", "4:5", "3:4", "2:3", "9:16", "4:1", "1:4", "8:1", "1:8",
  ]).optional().default("auto"),
  resolution: z.enum(["0.5K", "1K", "2K", "4K"]).optional().default("1K"),
  model: z.string().optional(),
});

export const createVideoBodySchema = z.object({
  mode: z.enum(["prompt", "animate", "reference", "extend", "first-last", "lipsync"]).optional(),
  prompt: z.string().optional(),
  image_url: z.string().url().optional(),
  end_image_url: z.string().url().optional(),
  video_url: z.string().url().optional(),
  audio_url: z.string().url().optional(),
  aspect_ratio: z.enum(["auto", "16:9", "9:16"]).optional().default("auto"),
  duration: z.enum(["4s", "6s", "7s", "8s"]).optional().default("8s"),
  resolution: z.enum(["720p", "1080p", "4k"]).optional().default("720p"),
  negative_prompt: z.string().optional(),
  generate_audio: z.boolean().optional().default(false),
  model: z.string().optional(),
});

export const createTextBodySchema = z.object({
  template: z.string().optional(),
  topic: z.string().min(1),
  length: z.enum(CAPTION_LENGTHS).optional().default("short"),
});

export const createAudioBodySchema = z.object({
  audio_urls: z.array(z.string().url()).min(1),
  language: z.string().optional().default("en"),
  chunk_level: z.enum(["none", "segment", "word"]).optional().default("word"),
  diarize: z.boolean().optional().default(false),
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

export const editBodySchema = z
  .object({
    video_url: z.string().url().optional(),
    audio_url: z.string().url().optional(),
    template: z.string().optional(),
    operations: z.array(editOperationSchema).optional(),
    output_format: z.enum(["mp4", "webm", "mov"]).optional().default("mp4"),
  })
  .refine(data => data.video_url || data.audio_url, {
    message: "Must provide at least one input (video_url or audio_url)",
  })
  .refine(data => data.template || (data.operations && data.operations.length > 0), {
    message: "Must provide either template or operations",
  });

export const createUpscaleBodySchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video"]),
  upscale_factor: z.number().min(1).max(4).optional().default(2),
  target_resolution: z.enum(["720p", "1080p", "1440p", "2160p"]).optional(),
});

export const createAnalyzeBodySchema = z.object({
  video_url: z.string().url(),
  prompt: z.string().min(1).max(2000),
  temperature: z.number().min(0).max(1).optional().default(0.2),
  max_tokens: z.number().int().min(1).max(4096).optional(),
});
